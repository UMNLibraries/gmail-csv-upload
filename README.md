# gmail-csv-upload

Google Apps Script to upload CSV attachments from Gmail to Google Drive, and optionally update a mirroring Google Sheet or merge multipart reports into one file. Used primarily for scheduled reports from Alma Analytics, but also for miscellaneous reports from UM Analytics and SenSource.

## Usage

### Overview

This Google Apps script:

1. searches a Gmail tag for unread emails,
2. unzips (if applicable) and uploads CSV attachments from those emails to a Drive folder, and
3. optionally performs one of the following tasks:
   * creates/overwrites a mirroring Google Sheet with the attachment data,
   * incrementally updates a linked Google Sheet with the attachment data, or
   * merges CSV from multiple partial reports into one file (useful for reports that exceed attachment limits).

This enables an automatic process for ingesting Alma Analytics scheduled reports into Tableau workbooks, without any ongoing manual actions or processes to run on a local machine. The Google Sheet can also be shared directly with others.

This script allows the choice of either full or incremental updates of a Google Sheet, merging files, or simple uploads, via tags in the filenames (as explained below). It automatically handles CSV files that have been compressed into a zip file, as Alma Analytics does when attachments exceed 2MB.

### Merging files

Data reporting platforms like Alma Analytics often have maximum report export file size limits, and Gmail separately has maximum attachment file size limits. For these reasons, one may need to break up large reports into separate smaller parts. The merging functionality allows multiple CSV files to be merged into one, zipped, and uploaded to Google Drive. It also shares the report in Google Drive with indicated recipients and sends an email informing them that a report is ready.

The Google Script platform **has a maximum upload file size** of 50MB _zipped_ (which appears to be around 200MB of unzipped CSV, for the files this is currently used with). A solution for merging even larger files has not been implemented.

## Setup

If this script is being used by a team for shared data sources, consider configuring it on a shared Google account, for maintainability.

### Main upload script

This script uses the Google Sheets [Advanced Google service](https://developers.google.com/apps-script/guides/services/advanced). This must be enabled for the script to run, as described below.

1. Create an Alma Analytics (or other platform) scheduled report to be sent as a CSV file.
   * If the data reported is for an incremental Google Sheet upload, include "`[CSV-UPLOAD-INC]`" in the report name.
     * Incremental reports should only include the data from the time period between scheduled reports. Any data repeated on multiple reports will be duplicated in the Sheet.
     * A daily incremental report, for example, can be generated with an SQL filter like `<some date dimension> = TIMESTAMPADD(SQL_TSI_DAY, -1, CURRENT_DATE)`.
   * If the data is to be fully replaced in a Google Sheet with each report, include "`[CSV-UPLOAD-FULL]`" in the report name.
   * To only upload and unzip (if applicable) the report, include "`[CSV-UPLOAD-UNZIP]`" in the report name.
   * To merge multipart reports into one CSV file, skip to the section [Setup: Merge script](#merge-script).
2. Create a label in Gmail, which will be used to mark specific emails with attachments for upload.
3. Create a filter in Gmail to assign the label to the relevant report emails and remove them from the inbox. **You should not open or “read” these emails, as the script searches for unread email**.
   1. To filter for our filename tags, use: `subject:({"[CSV-UPLOAD-INC]" "[CSV-UPLOAD-FULL]" "[CSV-UPLOAD-UNZIP]"})`.
   2. To capture all automated Alma report emails, add to the above: `from:(libnotic@umn.edu) "Attached please find the following Analytics report to which you are subscribed"`.
   3. Set filter actions: `Skip Inbox` and `Apply label <name of label>`
4. Create a Drive folder for uploads, and copy its ID from the folder’s URL (i.e., the whole string after `folders/`). Use a specific folder for this (not just My Drive), so that the script isn’t manipulating any unintended files.
5. Create new [Google Script](https://script.google.com) project from the same Google account as the Gmail filter and Drive folder.
   1. Copy/paste [update-sheet-api.js](/update-sheet-api.js) into your new project.
   2. Paste folder ID into empty string in `const folder =` line.
   3. Paste Gmail label name into empty string in `const attachments =` line.
   4. Save your project.
6. To the left of the code, click the "+" next to "Services."
   1. Select "Google Sheets API," and leave the default identifier of "`Sheets`."
7. Enable a timed trigger to schedule executions of the script.
   1. Click on "Triggers" > "+ Add Trigger"
   2. Ensure the trigger is set to run `gmailUploadAndUpdate`.
   3. Run the trigger as `Time-driven > Minutes timer > Every minute`. Several Alma Analytics reports are scheduled at various hours throughout the day, and this script deals with one upload at a time, so this allows for up to 60 reports to be scheduled during a specific hour.
   4. Set failure notification settings to your preference.

### Merge script

The merge process exists as a separate script and **must be configured with a separate Gmail label**.

1. Create a series of Alma Analytics (or other platform) scheduled reports to be sent as CSV files. Include "`[CSV-UPLOAD-MERGE-<index>]`" in the report names, replacing `<index>` with an ascending number.
   1. Reports are sorted in ascending numerical order by the index number before being merged.
2. Create a label in Gmail, which will be used to mark specific emails with attachments for merging. This label must be different than the label used for the main upload script.
3. Create a filter in Gmail to assign the label to the relevant report emails and remove them from the inbox. **You should not open or “read” these emails, as the script searches for unread email**.
   1. To filter for our filename merge tag, use: `subject:("[CSV-UPLOAD-MERGE")`.
   2. To capture all automated Alma report emails, add to the above: `from:(libnotic@umn.edu) "Attached please find the following Analytics report to which you are subscribed"`.
   3. Set filter actions: `Skip Inbox` and `Apply label <name of label>`
4. Create a Drive folder for merge uploads, and copy its ID from the folder’s URL (i.e., the whole string after `folders/`). Use a specific folder for this (not just My Drive), so that the script isn’t manipulating any unintended files.
5. Create new [Google Script](https://script.google.com) project from the same Google account as the Gmail filter and Drive folder.
   1. Copy/paste [merge-csv.js](/merge-csv.js) into your new project.
   2. Paste folder ID into empty string in `const folder =` line.
   3. Paste Gmail label name into empty string in `const attachments =` line.
   4. Save your project.
6. Enable a timed trigger to schedule executions of the script.
   1. Click on "Triggers" > "+ Add Trigger"
   2. Ensure the trigger is set to run `gmailMergeAndUpload`.
   3. Our current merge reports are scheduled monthly, so we run the trigger as `Time-driven > Day timer > 6am to 7am`. If the multiple reports take a long time to arrive, schedule the script to run late enough to ensure that all parts have already been received.
   4. Set failure notification settings to your preference.

### Initial data load for incremental report

If a baseline of historical data is needed for an incremental report, follow these steps to initialize your data, before the first incremental report is sent. If a baseline of older data is not needed, you do not need to follow these steps, as your first incremental report will create a Google Sheet with the full data and headers.

1. Edit your Alma Analytics report to contain the full range of dates that you would like to begin with.
2. Download your report as a CSV file. Ensure that this file has the same filename as the incremental report that you scheduled (i.e., just do this in the same analysis as the scheduled report, but don’t save your changes after you’ve removed your date filter).
3. Email this report to the Gmail account that is running this script. Move the email to the label chosen above, and mark it as "unread."
4. Open your Google Script project and click "Run."

The initial CSV upload and Google Sheet should now both exist in your chosen folder.

## Limitations

Google Sheets have a 10 million cell limit. If your collected report grows to exceed this limit, you’ll need to rename your reports/Sheets to split up the full data set (e.g., rename the initial Sheet to "XYZ report 1," and rename your scheduled report to "XYZ report 2.")
