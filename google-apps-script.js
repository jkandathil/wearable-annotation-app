/**
 * Google Apps Script Code
 * 
 * SETUP INSTRUCTIONS:
 * 1. Go to https://script.google.com/
 * 2. Create a new project (or open your existing one)
 * 3. Copy and paste this entire code
 * 4. Click on "Deploy" > "New deployment" (or "Manage deployments" > "Edit" > "New version")
 * 5. Select type: "Web app"
 * 6. Execute as: "Me"
 * 7. Who has access: "Anyone"
 * 8. Click "Deploy"
 * 9. Copy the web app URL and update the SCRIPT_URL in index.html
 */

// Configuration
const ANNOTATION_FOLDER_NAME = 'Wearable_deepskin_context'; // Folder for annotations
const SENSOR_DATA_FOLDER_NAME = 'Wearable sensor data';     // Folder for device data

/**
 * Handle POST requests from the web app
 */
function doPost(e) {
  try {
    // Parse the incoming data
    const data = JSON.parse(e.postData.contents);

    // Dispatch based on action
    if (data.action === 'get_device_health') {
      return handleGetDeviceHealth(data.deviceId);
    } else {
      // Default to submitting annotation
      return handleSubmitAnnotation(data);
    }

  } catch (error) {
    Logger.log('Error: ' + error.toString());
    return createJsonResponse({
      success: false,
      message: 'Error: ' + error.toString()
    });
  }
}

/**
 * Handle GET requests (for testing)
 */
function doGet(e) {
  return createJsonResponse({
    status: 'Annotation App API is running',
    message: 'Send POST requests with action="submit_annotation" or action="get_device_health"'
  });
}

/**
 * Handle device health data retrieval
 */
function handleGetDeviceHealth(deviceId) {
  if (!deviceId) {
    return createJsonResponse({ success: false, message: 'Device ID is required' });
  }

  // Find the sensor data folder
  const folders = DriveApp.getFoldersByName(SENSOR_DATA_FOLDER_NAME);
  if (!folders.hasNext()) {
    return createJsonResponse({ success: false, message: `Folder "${SENSOR_DATA_FOLDER_NAME}" not found` });
  }
  const folder = folders.next();

  // Search for files containing the Device ID
  // We use searchFiles to find files that contain the deviceId in the name and are not trashed
  const query = `title contains '${deviceId}' and trashed = false`;
  const files = folder.searchFiles(query);

  let targetFile = null;
  // If multiple found, try to find exact match or just take the first one
  // Prioritize exact match "deviceId.csv"

  const potentialFiles = [];
  while (files.hasNext()) {
    potentialFiles.push(files.next());
  }

  if (potentialFiles.length === 0) {
    return createJsonResponse({ success: false, message: `No files found matching Device ID "${deviceId}"` });
  }

  // sort by last updated to get the most recent file if duplicates?
  // Or match exact name. Let's try to match exact name "DeviceID.csv" first.
  targetFile = potentialFiles.find(f => f.getName() === `${deviceId}.csv`);

  if (!targetFile) {
    // If no exact match, use the first one found
    targetFile = potentialFiles[0];
  }

  // Read the file
  const csvContent = targetFile.getBlob().getDataAsString();
  const csvData = Utilities.parseCsv(csvContent);

  if (csvData.length < 2) {
    return createJsonResponse({ success: false, message: 'File is empty or has no data' });
  }

  // Get headers
  const headers = csvData[0];

  // Get the last row (most recent data)
  const lastRow = csvData[csvData.length - 1];

  // Find indices for required columns
  // Flexible matching for Temperature/Temp and Humidity/Hum
  const tempIndex = headers.findIndex(h => h.match(/Temperature|Temp/i));
  const humIndex = headers.findIndex(h => h.match(/Humidity|Hum/i));
  const batteryIndex = headers.findIndex(h => h.match(/Bat\(%\)|Bat%|Battery|Batt|Charge|Voltage/i));

  // Find Timestamp column
  const timeIndex = headers.findIndex(h => h.match(/Timestamp|Time|Date|Created/i));

  // Find CHR0 to CHR31
  const channelValues = [];
  const channelLabels = [];

  for (let i = 0; i < 32; i++) {
    const colName = `CHR${i}`;
    const idx = headers.indexOf(colName);
    if (idx !== -1) {
      channelLabels.push(colName);
      channelValues.push(Number(lastRow[idx]));
    }
  }

  // Determine the timestamp to display
  // Prioritize data timestamp, fallback to file last updated
  let displayTime = targetFile.getLastUpdated().toISOString();
  let timeSource = 'file';

  if (timeIndex !== -1 && lastRow[timeIndex]) {
    displayTime = lastRow[timeIndex];
    timeSource = 'data';
  }

  const result = {
    success: true,
    fileName: targetFile.getName(),
    lastUpdated: displayTime, // Sending data time if available
    timeSource: timeSource,
    temperature: tempIndex !== -1 ? lastRow[tempIndex] : 'N/A',
    humidity: humIndex !== -1 ? lastRow[humIndex] : 'N/A',
    battery: batteryIndex !== -1 ? lastRow[batteryIndex] : 'N/A',
    channels: {
      labels: channelLabels,
      values: channelValues
    }
  };

  return createJsonResponse(result);
}

/**
 * Handle annotation submission
 */
function handleSubmitAnnotation(data) {
  const userName = data.userName;
  const deviceId = data.deviceId;
  const eventId = data.eventId;
  const context = data.context || '';
  const timestamp = data.timestamp || new Date().toISOString();

  if (!userName || !deviceId || !eventId) {
    return createJsonResponse({ success: false, message: 'Missing required fields' });
  }

  const result = saveToGoogleDrive(userName, deviceId, eventId, context, timestamp);

  return createJsonResponse({
    success: true,
    message: 'Data saved successfully',
    fileName: result.fileName
  });
}

/**
 * Helper to create JSON response
 */
function createJsonResponse(data) {
  return ContentService.createTextOutput(JSON.stringify(data))
    .setMimeType(ContentService.MimeType.JSON);
}

/**
 * Save data to Google Drive as CSV
 */
function saveToGoogleDrive(userName, deviceId, eventId, context, timestamp) {
  const folder = getOrCreateFolder(ANNOTATION_FOLDER_NAME);
  const fileName = sanitizeFileName(userName) + '_' + sanitizeFileName(deviceId) + '.csv';
  const formattedTimestamp = new Date(timestamp).toLocaleString();
  const csvRow = `${escapeCsvField(formattedTimestamp)},${escapeCsvField(userName)},${escapeCsvField(deviceId)},${escapeCsvField(eventId)},${escapeCsvField(context)}\n`;

  const files = folder.getFilesByName(fileName);

  if (files.hasNext()) {
    const file = files.next();
    const existingContent = file.getBlob().getDataAsString();
    const newContent = existingContent + csvRow;
    file.setContent(newContent);
  } else {
    const csvHeader = '"Timestamp","User Name","Device ID","Event ID","Context"\n';
    const content = csvHeader + csvRow;
    folder.createFile(fileName, content, MimeType.CSV);
  }

  return {
    fileName: fileName,
    folder: folder.getName()
  };
}

/**
 * Get or create a folder in Google Drive
 */
function getOrCreateFolder(folderName) {
  const folders = DriveApp.getFoldersByName(folderName);
  return folders.hasNext() ? folders.next() : DriveApp.createFolder(folderName);
}

/**
 * Sanitize filename
 */
function sanitizeFileName(str) {
  return str.replace(/[^a-zA-Z0-9_-]/g, '_');
}

/**
 * Escape CSV field
 */
function escapeCsvField(field) {
  field = String(field);
  if (field === '') return '';
  if (field.includes('"') || field.includes(',') || field.includes('\n') || field.includes('\r')) {
    field = field.replace(/"/g, '""');
    return '"' + field + '"';
  }
  return field;
}

