function gmailUploadAndUpdate() {
  // Paste Folder ID below
  const folder = DriveApp.getFolderById('');
  // Paste label name below
  const attachments = getLabeledAttachments('');

  function getLabeledAttachments(labelName) {
    const label = GmailApp.getUserLabelByName(labelName);
    if (label.getUnreadCount() == 0) return [];
    
    const threads = label.getThreads(0, label.getUnreadCount());
    const unreadThreads = threads.filter(thread => thread.isUnread());
    const attachments = [];
  
    for (const thread of unreadThreads) {
      const attachment = thread.getMessages()[0]
        .getAttachments({ includeInlineImages: false })[0];
      attachments.push(attachment);
      thread.markRead();
    }
    
    console.log(`Retrieved attachments: ${attachments.map(a => a.getName())}`);
    return attachments;
  }

  function uploadLabeledAttachments(folder, attachments) {
    for (const attachment of attachments) {
      const fileName = attachment.getName().slice(0, attachment.getName().lastIndexOf('.'));
      const fileTypes = ['.csv', '.zip'];

      for (const fileType of fileTypes) {
        const existingFile = folder.getFilesByName(fileName + fileType);

        while (existingFile.hasNext()) {
          existingFile.next().setTrashed(true);
        }
      }
  
      folder.createFile(attachment.copyBlob()).setName(attachment.getName());
      console.log(`Uploaded: ${attachment.getName()}`);
    }
  }

  function createOrUpdateSheet(folder, attachments) {
    for (const attachment of attachments) {
      // Create or locate existing Sheet
      const fileName = attachment.getName().slice(0, attachment.getName().lastIndexOf('.'));
      const sheetName = `${fileName} [SHEET]`;
      const matchingSheet = folder.getFilesByName(sheetName);
      let newSheet = null;

      const file = folder.getFilesByName(attachment.getName()).next();

      if (!matchingSheet.hasNext() && !file.getName().includes('[CSV-UPLOAD-UNZIP]')) {
        newSheet = SpreadsheetApp.create(sheetName);
        DriveApp.getFileById(newSheet.getId()).moveTo(folder);
        newSheet.getActiveSheet().deleteColumns(1, 25);
        newSheet.getActiveSheet().deleteRows(1, 999);
      }

      let targetSpreadsheet;
      let targetSheet;

      if (!file.getName().includes('[CSV-UPLOAD-UNZIP]')) {
        targetSpreadsheet = newSheet || SpreadsheetApp.open(matchingSheet.next());
        targetSheet = targetSpreadsheet.getActiveSheet();
      }

      // Parse CSV into Sheet, if applicable
      let blob;

      if (file.getMimeType().includes('zip')) {
        blob = Utilities.unzip(file.getBlob().setContentTypeFromExtension())[0];
      } else {
        blob = file.getBlob();
      }

      let data = Utilities.parseCsv(blob.getDataAsString());

      if (data[0][0].trim() == 'The query resulted in no rows') {
        console.log(`Empty report: ${blob.getName()}`);
        continue;
      }

      if (!newSheet && file.getName().includes('[CSV-UPLOAD-INC]')) {
        // Existing incremental upload
        data = data.slice(1);
        targetSheet.insertRows(2, data.length);
        targetSheet.getRange(2, 1, data.length, data[0].length).setValues(data);
        console.log(`Incremental update: ${targetSpreadsheet.getName()}`);
      } else if (file.getName().includes('[CSV-UPLOAD-UNZIP]')) {
        if (file.getMimeType().includes('zip')) {
          folder.createFile(blob).setName(blob.getName());
          console.log(`Upload unzipped: ${blob.getName()}`);
        } else {
          continue;
        }
      } else {
        // New incremental and all full uploads
        targetSheet.clear();
        SpreadsheetApp.flush();
        // Use Sheets API batchUpdate for speed
        // https://developers.google.com/apps-script/advanced/sheets
        console.log(`API batchUpdate begin: ${targetSpreadsheet.getName()}`);
        for (let i = 0; i <= data.length; i += 100000) {
          const dataSlice = data.slice(i, i + 100000);

          while (targetSheet.getMaxRows() < i + dataSlice.length) {
            targetSheet.insertRowsAfter(targetSheet.getMaxRows(), 10000);
          }

          const range = targetSheet.getRange(i + 1, 1, dataSlice.length, dataSlice[0].length)
          .getA1Notation();
          const request = {
            'valueInputOption': 'RAW',
            'data': [
              {
                'range': `${targetSheet.getSheetName()}!${range}`,
                'majorDimension': 'ROWS',
                'values': dataSlice,
              }
            ]
          };
          try {
            const response = Sheets.Spreadsheets.Values.batchUpdate(request, targetSpreadsheet.getId());
            if (response) console.log(response);
          } catch (error) {
            console.error(error.message);
          }
        }
        console.log(`API batchUpdate end: ${targetSpreadsheet.getName()}`);
      }
    }
  }

  uploadLabeledAttachments(folder, attachments);
  createOrUpdateSheet(folder, attachments);
}
