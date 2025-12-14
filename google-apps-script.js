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
const VERSION = '1.0.1'; // Increment this to verify deployment
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
    } else if (data.action === 'get_offline_data') {
      return handleGetOfflineData(data.deviceId);
    } else if (data.action === 'get_env_history') {
      return handleGetEnvHistory(data.deviceId);
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
 * Helper to find device file
 */
function findDeviceFile(deviceId) {
  const folders = DriveApp.getFoldersByName(SENSOR_DATA_FOLDER_NAME);
  if (!folders.hasNext()) return null;
  const folder = folders.next();

  const query = `title contains '${deviceId}' and trashed = false`;
  const files = folder.searchFiles(query);

  const potentialFiles = [];
  while (files.hasNext()) {
    const f = files.next();
    // Prioritize Google Sheets
    if (f.getMimeType() === MimeType.GOOGLE_SHEETS) {
      potentialFiles.push(f);
    }
  }

  if (potentialFiles.length === 0) return null;

  let targetFile = potentialFiles.find(f => f.getName() === deviceId);
  if (!targetFile) targetFile = potentialFiles[0];

  return targetFile;
}

/**
 * Helper to read data from file (Sheet or CSV)
 */
function readDataFromFile(file) {
  if (file.getMimeType() === MimeType.GOOGLE_SHEETS) {
    return SpreadsheetApp.open(file).getSheets()[0].getDataRange().getValues();
  } else {
    // Fallback for CSV
    return Utilities.parseCsv(file.getBlob().getDataAsString());
  }
}

/**
 * Handle device health data retrieval
 */
function handleGetDeviceHealth(deviceId) {
  if (!deviceId) return createJsonResponse({ success: false, message: 'Device ID is required' });

  const targetFile = findDeviceFile(deviceId);
  if (!targetFile) {
    return createJsonResponse({ success: false, message: `No files found matching Device ID "${deviceId}"` });
  }

  // Read the file
  // Read the file
  const csvData = readDataFromFile(targetFile);

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
    version: VERSION,
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
 * Handle getting offline data for the last 12 hours
 */
function handleGetOfflineData(deviceId) {
  if (!deviceId) return createJsonResponse({ success: false, message: 'Device ID is required' });

  const targetFile = findDeviceFile(deviceId);
  if (!targetFile) {
    return createJsonResponse({ success: false, message: `No files found matching Device ID "${deviceId}"` });
  }

  const csvData = readDataFromFile(targetFile);

  if (csvData.length < 2) {
    return createJsonResponse({ success: false, message: 'File is empty or has no data' });
  }

  const headers = csvData[0];
  const timeIndex = headers.findIndex(h => h.match(/Timestamp|Time|Date|Created/i));

  if (timeIndex === -1) {
    return createJsonResponse({ success: false, message: 'Timestamp column not found in CSV' });
  }

  const now = new Date();
  const cutoffTime = new Date(now.getTime() - 12 * 60 * 60 * 1000); // 12 hours ago

  const validTimestamps = [];

  // Parse rows (skip header)
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (row[timeIndex]) {
      // Trying to parse ISO or other formats
      const ts = new Date(row[timeIndex]);
      if (!isNaN(ts.getTime()) && ts >= cutoffTime) {
        validTimestamps.push(ts.getTime());
      }
    }
  }

  validTimestamps.sort((a, b) => a - b);

  // Calculate offline intervals (> 1 minute gaps)
  const offlineIntervals = [];
  const THRESHOLD_MS = 60 * 1000; // 1 minute

  for (let i = 1; i < validTimestamps.length; i++) {
    const diff = validTimestamps[i] - validTimestamps[i - 1];
    if (diff > THRESHOLD_MS) {
      offlineIntervals.push({
        start: new Date(validTimestamps[i - 1]).toISOString(),
        end: new Date(validTimestamps[i]).toISOString(),
        durationMins: Math.round(diff / 60000)
      });
    }
  }

  // Also check gap between last data and now
  const lastTs = validTimestamps[validTimestamps.length - 1];
  if (lastTs && (now.getTime() - lastTs > THRESHOLD_MS)) {
    offlineIntervals.push({
      start: new Date(lastTs).toISOString(),
      end: now.toISOString(),
      durationMins: Math.round((now.getTime() - lastTs) / 60000),
      isCurrent: true
    });
  }

  return createJsonResponse({
    success: true,
    intervals: offlineIntervals,
    dataPoints: validTimestamps.length
  });
}

/**
 * Handle getting environmental history (Temp/Hum) for the last 3 hours
 */
function handleGetEnvHistory(deviceId) {
  if (!deviceId) return createJsonResponse({ success: false, message: 'Device ID is required' });

  const targetFile = findDeviceFile(deviceId);
  if (!targetFile) {
    return createJsonResponse({ success: false, message: `No files found matching Device ID "${deviceId}"` });
  }

  const csvData = readDataFromFile(targetFile);
  if (csvData.length < 2) {
    return createJsonResponse({ success: false, message: 'File is empty or has no data' });
  }

  const headers = csvData[0];

  // Find indices
  const tempIndex = headers.findIndex(h => h.match(/Temperature|Temp/i));
  const humIndex = headers.findIndex(h => h.match(/Humidity|Hum/i));
  const gasIndex = headers.findIndex(h => h.match(/GASR0|Gas\(Res\)/i));
  const battIndex = headers.findIndex(h => h.match(/Bat\(%\)|Bat%|Battery|Batt|Charge|Voltage/i));
  const timeIndex = headers.findIndex(h => h.match(/Timestamp|Time|Date|Created/i));

  if (timeIndex === -1) {
    return createJsonResponse({ success: false, message: 'Timestamp column not found' });
  }

  // Parse all valid rows with timestamps
  const parsedRows = [];
  for (let i = 1; i < csvData.length; i++) {
    const row = csvData[i];
    if (row[timeIndex]) {
      const ts = new Date(row[timeIndex]);
      if (!isNaN(ts.getTime())) {
        parsedRows.push({
          timestamp: ts,
          temp: tempIndex !== -1 ? Number(row[tempIndex]) : null,
          hum: humIndex !== -1 ? Number(row[humIndex]) : null,
          gasr0: gasIndex !== -1 ? Number(row[gasIndex]) : null,
          battery: battIndex !== -1 ? Number(row[battIndex]) : null
        });
      }
    }
  }

  // Sort by time
  parsedRows.sort((a, b) => a.timestamp - b.timestamp);

  if (parsedRows.length === 0) {
    return createJsonResponse({ success: true, timestamps: [], temperature: [], humidity: [] });
  }

  // Filter for last 3 hours relative to the most recent data point
  const lastTime = parsedRows[parsedRows.length - 1].timestamp;
  const threeHoursAgo = new Date(lastTime.getTime() - 3 * 60 * 60 * 1000);

  const filteredData = parsedRows.filter(row => row.timestamp >= threeHoursAgo);

  return createJsonResponse({
    success: true,
    timestamps: filteredData.map(r => r.timestamp.toISOString()),
    temperature: filteredData.map(r => r.temp),
    humidity: filteredData.map(r => r.hum),
    gasr0: filteredData.map(r => r.gasr0),
    battery: filteredData.map(r => r.battery)
  });
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
