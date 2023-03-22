function gmailMergeAndUpload() {
  // Paste Folder ID below
  const folder = DriveApp.getFolderById('');
  // Paste label name below
  const attachments = getLabeledAttachmentsGrouped('');

  function getLabeledAttachmentsGrouped(labelName) {
    const label = GmailApp.getUserLabelByName(labelName);
    if (label.getUnreadCount() == 0) return [];
    
    const threads = label.getThreads(0, label.getUnreadCount());
    const unreadThreads = threads.filter(thread => thread.isUnread());
    const attachments = [[]];
  
    for (const thread of unreadThreads) {
      const attachment = thread.getMessages()[0]
        .getAttachments({ includeInlineImages: false })[0];
      thread.markRead();

      if (!attachments[0][0]) {
        attachments[0].push(attachment);
        continue;
      }

      const fileName = attachment.getName()
        .slice(0, attachment.getName().lastIndexOf('[')).trim();
      const groupNames = attachments.map(group => {
        return group[0].getName()
          .slice(0, group[0].getName().lastIndexOf('[')).trim();
      });
      const groupIndex = groupNames.findIndex(group => group == fileName)

      if (groupIndex === -1) {
        attachments.push([attachment]);
      } else {
        attachments[groupIndex].push(attachment);
      }
    }
  
    return attachments;
  }

  function uploadMergedAttachments(folder, attachments) {
    for (const group of attachments) {
      // Delete previous merged CSV
      const groupFileName = group[0].getName()
        .slice(0, group[0].getName().lastIndexOf('[')).trim() + '.csv';
      const existingFile = folder.getFilesByName(groupFileName);
      while (existingFile.hasNext()) {
        existingFile.next().setTrashed(true);
      }

      let csvString = '';

      for (let attachment of group) {
        console.log(attachment.getContentType());
        // Unzip if needed and convert to string
        if (attachment.getContentType() === 'application/zip') {
          attachment = Utilities.unzip(attachment)[0];
        }
        let string = attachment.getDataAsString();

        if (string.includes('The query resulted in no rows')) {
          console.log('no data');
          continue;
        }

        if (csvString.length === 0) {
          csvString += string;
        } else {
          csvString += string.slice(string.indexOf('\n') + 1);
        }
      }

      const blob = Utilities.newBlob(csvString, 'text/csv');
      folder.createFile(blob.setName(groupFileName));
    }
  }

  uploadMergedAttachments(folder, attachments);
}
