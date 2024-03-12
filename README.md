# gmail-csv-upload

Google Apps Script to upload CSV attachments from Gmail to Google Drive, and update a mirroring Google Sheet. Used for scheduled reports from Alma Analytics.

## Usage

This Google Apps script:

1. searches a Gmail tag for unread emails,
1. uploads CSV attachments from those emails to a Drive folder, and
1. creates/updates a mirroring Google Sheet with the attachment data.

This enables an automatic process for ingesting Alma Analytics scheduled reports into Tableau workbooks, without any ongoing manual actions or processes to run on a local machine. The Google Sheet can also be shared directly with others.

This script allows for **either full or incremental updates**, via tags in the filenames, as explained below. It also handles CSV files that have been compressed into a zip file, as Alma Analytics does when attachments exceed 2MB.

## Setup

If this is being used by a team for shared data sources, consider configuring it on a shared Google account, for maintainability.

1. Create an Alma Analytics scheduled report to be sent as a CSV file.
   * If the data reported is incremental, include "`[CSV-UPLOAD-INC]`" in the report name.
     * Incremental reports should only include the data from the time period between scheduled reports. Any data repeated on multiple reports will be duplicated in the Sheet.
     * A daily incremental report, for example, can be generated with an SQL filter like `<some date dimension> = TimeStampAdd(SQL_TSI_DAY,-1,Current_Date)`.
   * If the data is to be fully replaced with each report, include "`[CSV-UPLOAD-FULL]`" in the report name.
1. Create a label in Gmail, which will be used to mark specific emails with attachments for upload.
1. Create a filter in Gmail to assign the label to the relevant report emails and remove them from the inbox. **You should not open or “read” these emails, as the script searches for unread email**.
   1. To capture all automated Alma report emails, use: `from:(libnotic@umn.edu) "Attached please find the following Analytics report to which you are subscribed"`.
   1. To filter for our filename tags, add to the above: `subject:({"[CSV-UPLOAD-INC]" "[CSV-UPLOAD-FULL]"})`.
   1. Set filter actions: `Skip Inbox` and `Apply label <name of label>`
1. Create a Drive folder for uploads, and copy its ID from the folder’s URL (i.e., the whole string after `folders/`). Use a specific folder for this (not just My Drive), so that the script isn’t manipulating any other files.
1. Create new [Google Script](https://script.google.com) project from the same Google account as the Gmail filter and Drive folder.
   1. Copy/paste [update-sheet-api.js](/update-sheet-api.js) into your new project.
   1. Paste folder ID into empty string in `const folder =` line.
   1. Paste Gmail label name into empty string in `const attachments =` line.
   1. Save your project.
1. Enable a timed trigger to schedule executions of the script.
   1. Click on "Triggers" > "+ Add Trigger"
   1. Ensure the trigger is set to run `gmailUploadAndUpdate`.
   1. Since Alma Analytics reports are scheduled at various hours throughout the day, run the trigger as `Time-driven > Hour timer > Every hour`.
   1. Set failure notification settings to your preference.

### Initial data load for incremental report

If a baseline of historical data is needed for an incremental report, follow these steps to initialize your data, before the first incremental report is sent. If a baseline of older data is not needed, you do not need to follow these steps, as your first incremental report will create a Google Sheet with the full data and headers.

1. Edit your Alma Analytics report to contain the full range of dates that you would like to begin with.
1. Download your report as a CSV file. Ensure that this file has the same filename as the incremental report that you scheduled (i.e., just do this in the same analysis as the scheduled report, but don’t save your changes after you’ve removed your date filter).
1. Email this report to the Gmail account that is running this script. Move the email to the label chosen above, and mark it as "unread."
1. Open your Google Script project and click "Run."

The initial CSV upload and Google Sheet should now both exist in your chosen folder.

## Limitations

Google Sheets have a 10 million cell limit. If your collected report grows to exceed this limit, you’ll need to rename your reports/Sheets to split up the full data set (e.g., rename the initial Sheet to "XYZ report 1," and rename your scheduled report to "XYZ report 2.")
