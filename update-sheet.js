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
    }
  }

  function createOrUpdateSheet(folder, attachments) {
    for (const attachment of attachments) {
      // Create or locate existing Sheet
      const fileName = attachment.getName().slice(0, attachment.getName().lastIndexOf('.'));
      const sheetName = `${fileName} [SHEET]`;
      const matchingSheet = folder.getFilesByName(sheetName);
      let newSheet = null;

      if (!matchingSheet.hasNext()) {
        newSheet = SpreadsheetApp.create(sheetName);
        DriveApp.getFileById(newSheet.getId()).moveTo(folder);
      }

      let targetSheet = newSheet || SpreadsheetApp.open(matchingSheet.next());
      targetSheet = targetSheet.getActiveSheet();

      // Parse CSV into Sheet
      const file = folder.getFilesByName(attachment.getName()).next();
      let blob;

      if (file.getMimeType() == 'application/zip') {
        blob = Utilities.unzip(file.getBlob())[0];
      } else {
        blob = file.getBlob();
      }

      let data = Utilities.parseCsv(blob.getDataAsString());

      if (data[0][0].trim() == 'The query resulted in no rows') return;

      if (!newSheet && !file.getName().includes('[CSV-UPLOAD-FULL]')) {
        // Existing incremental upload
        data = data.slice(1);
        targetSheet.insertRows(2, data.length);
        targetSheet.getRange(2, 1, data.length, data[0].length).setValues(data);
      } else {
        targetSheet.clear();
        targetSheet.getRange(1, 1, data.length, data[0].length).setValues(data);
      }
    }
  }

  uploadLabeledAttachments(folder, attachments);
  createOrUpdateSheet(folder, attachments);
}
