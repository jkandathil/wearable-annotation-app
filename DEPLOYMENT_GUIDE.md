# Quick Deployment Guide

Follow these steps to get your Annotation App live:

## Step 1: Setup Google Apps Script (5 minutes)

1. Open https://script.google.com/
2. Click **"New Project"**
3. Copy code from `google-apps-script.js` and paste it
4. Click **"Deploy"** → **"New deployment"**
5. Select type: **"Web app"**
6. Set **"Execute as"**: Me
7. Set **"Who has access"**: Anyone
8. Click **"Deploy"** and authorize
9. **Copy the deployment URL** (looks like `https://script.google.com/macros/s/.../exec`)

## Step 2: Configure the Frontend (1 minute)

1. Open `index.html`
2. Find line 145: `const SCRIPT_URL = 'YOUR_GOOGLE_APPS_SCRIPT_URL_HERE';`
3. Replace with your URL: `const SCRIPT_URL = 'https://script.google.com/macros/s/.../exec';`
4. Save the file

## Step 3: Test Locally (1 minute)

1. Open `index.html` in your browser
2. Fill out the form and click Submit
3. Check your Google Drive for a new folder: **AnnotationApp_Data**
4. Verify the CSV file was created

## Step 4: Deploy to GitHub Pages (5 minutes)

### Option A: Using Git Command Line

```bash
# Initialize git repository
git init

# Add files (excluding google-apps-script.js)
git add .

# Commit
git commit -m "Initial commit: Annotation App"

# Create repository on GitHub, then:
git remote add origin https://github.com/YOUR_USERNAME/YOUR_REPO_NAME.git
git branch -M main
git push -u origin main
```

### Option B: Using GitHub Web Interface

1. Create a new repository on GitHub
2. Upload `index.html` and `README.md` through the web interface
3. Don't upload `google-apps-script.js` (it stays private)

### Enable GitHub Pages

1. Go to repository **Settings** → **Pages**
2. Source: **main** branch
3. Click **Save**
4. Wait 1-2 minutes
5. Your app is live at: `https://YOUR_USERNAME.github.io/YOUR_REPO_NAME/`

## Done! 🎉

Share the GitHub Pages URL with your users. They can now submit annotations that save to your Google Drive!

## Quick Troubleshooting

- **"Please configure the Google Apps Script URL"** → Check Step 2
- **Data not saving** → Verify Apps Script URL ends with `/exec`
- **Permission errors** → Re-authorize Apps Script access
- **GitHub Pages not working** → Wait a few minutes, check Settings > Pages

## Where is my data?

Your Google Drive → **AnnotationApp_Data** folder → CSV files named `UserName_DeviceID.csv`

