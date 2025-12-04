# Annotation App

A web-based annotation form that saves data to Google Drive as CSV files. Users can submit annotations with their name, device ID, and context information.

## Features

- 📝 Simple form interface with User Name, Device ID, and Context fields
- 💾 Automatically saves data to Google Drive as CSV files
- 📊 Creates separate CSV files for each user+device combination
- 🔄 Appends new submissions to existing files
- ⏰ Automatically adds timestamps to each submission
- 💫 Modern, responsive UI
- 🔒 Remembers User Name and Device ID (clears only Context after submission)
- 🚀 Can be deployed on GitHub Pages

## Setup Instructions

### Part 1: Set Up Google Apps Script (Backend)

1. **Go to Google Apps Script:**
   - Visit https://script.google.com/
   - Sign in with your Google account

2. **Create New Project:**
   - Click "New Project"
   - Give it a name like "Annotation App Backend"

3. **Add the Code:**
   - Delete any existing code
   - Copy all code from `google-apps-script.js`
   - Paste it into the script editor

4. **Deploy as Web App:**
   - Click "Deploy" > "New deployment"
   - Click the gear icon (⚙️) and select "Web app"
   - Configure:
     - **Description:** "Annotation App v1"
     - **Execute as:** "Me (your email)"
     - **Who has access:** "Anyone" (or "Anyone with Google account")
   - Click "Deploy"
   - **Authorize access** when prompted (review permissions)
   - **Copy the Web App URL** (it will look like: `https://script.google.com/macros/s/...../exec`)

5. **Test the Deployment:**
   - Open the Web App URL in a browser
   - You should see: `{"status":"Annotation App API is running",...}`

### Part 2: Configure the Frontend

1. **Edit `index.html`:**
   - Open the `index.html` file
   - Find the line: `const SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';`
   - Replace `'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE'` with your Web App URL from Part 1
   - Save the file

Example:
```javascript
const SCRIPT_URL = 'https://script.google.com/macros/s/AKfycbz.../exec';
```

### Part 3: Deploy to GitHub Pages

1. **Create a GitHub Repository:**
   - Go to https://github.com/
   - Click "New repository"
   - Name it (e.g., "annotation-app")
   - Make it Public
   - Click "Create repository"

2. **Upload Your Files:**
   ```bash
   git init
   git add index.html README.md
   git commit -m "Initial commit"
   git branch -M main
   git remote add origin https://github.com/YOUR_USERNAME/annotation-app.git
   git push -u origin main
   ```

3. **Enable GitHub Pages:**
   - Go to your repository on GitHub
   - Click "Settings" > "Pages"
   - Under "Source", select "main" branch
   - Click "Save"
   - Your site will be live at: `https://YOUR_USERNAME.github.io/annotation-app/`

## How It Works

1. **User fills out the form** with User Name, Device ID, and Context
2. **On submission**, the data is sent to Google Apps Script
3. **Google Apps Script** creates or updates a CSV file in Google Drive:
   - Filename format: `UserName_DeviceID.csv`
   - Location: A folder named `AnnotationApp_Data` in your Google Drive
4. **Data is appended** to the CSV with a timestamp
5. **Context field is cleared** for the next entry
6. **User Name and Device ID remain** for convenience

## CSV File Format

Each CSV file contains:
- **Timestamp**: Date and time of submission
- **User Name**: Name of the user
- **Device ID**: Device identifier
- **Context**: The annotation/context text

Example:
```csv
"Timestamp","User Name","Device ID","Context"
"12/3/2025, 10:30:15 AM","John Doe","Device001","First annotation here"
"12/3/2025, 10:35:22 AM","John Doe","Device001","Second annotation here"
```

## Google Drive Structure

```
Google Drive (Root)
└── AnnotationApp_Data/
    ├── JohnDoe_Device001.csv
    ├── JaneSmith_Device002.csv
    └── ...
```

## Customization

### Change Folder Name
Edit the `FOLDER_NAME` constant in `google-apps-script.js`:
```javascript
const FOLDER_NAME = 'YourCustomFolderName';
```
Then redeploy the Apps Script.

### Modify Form Fields
Edit the HTML structure in `index.html` and update the JavaScript and Google Apps Script accordingly.

### Update Styling
Modify the CSS in the `<style>` section of `index.html`.

## Testing Locally

Simply open `index.html` in a web browser. Make sure you've configured the `SCRIPT_URL` first.

## Troubleshooting

### "Please configure the Google Apps Script URL"
- Make sure you've replaced `YOUR_GOOGLE_APPS_SCRIPT_URL_HERE` in `index.html` with your actual Apps Script URL

### Data not saving
- Check that your Apps Script deployment is set to "Anyone" for access
- Verify the URL is correct and ends with `/exec`
- Check the Apps Script logs: Script editor > "Executions" tab

### Permission errors
- Make sure you've authorized the Apps Script to access your Google Drive
- Try re-deploying the script with proper permissions

## Security Notes

- The Apps Script runs with your permissions
- Anyone with the web app link can submit data
- For more security, set Apps Script access to "Anyone with Google account"
- Consider adding authentication for production use

## License

Free to use and modify for your needs.

## Support

For issues or questions, please create an issue on GitHub.

