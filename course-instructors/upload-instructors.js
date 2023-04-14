function uploadInstructors() {
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

      let blob;

      if (attachment.getContentType() == 'application/zip') {
        blob = Utilities.unzip(attachment.copyBlob())[0];
      } else {
        blob = attachment.copyBlob();
      }
  
      folder.createFile(blob).setName(blob.getName());
    }
  }

  uploadLabeledAttachments(folder, attachments);
}
