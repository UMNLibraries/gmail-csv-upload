function gmailMergeAndUpload() {
  // Paste Folder ID below
  const folder = DriveApp.getFolderById('');
  // Paste label name below
  const attachments = getLabeledAttachmentsGrouped('');

  const files = [];

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
        .slice(0, group[0].getName().lastIndexOf('[')).trim();
      const existingFile = folder.getFilesByName(`${groupFileName}.zip`);
      while (existingFile.hasNext()) {
        existingFile.next().setTrashed(true);
      }

      // Sort attachments
      const digitsRegex = /(\d+)\]\.(?:csv|zip)$/;
      group.sort((a, b) => {
        a = a.getName().match(digitsRegex)[1];
        b = b.getName().match(digitsRegex)[1];
        return a - b;
      });

      let csvString = '';

      for (let attachment of group) {
        // Unzip if needed and convert to string
        if (attachment.getContentType() === 'application/zip') {
          attachment = Utilities.unzip(attachment)[0];
        }
        let string = attachment.getDataAsString();

        if (string.includes('The query resulted in no rows')) {
          continue;
        }

        if (csvString.length === 0) {
          csvString += string;
        } else {
          csvString += string.slice(string.indexOf('\n'));
        }
      }

      let blob = Utilities.newBlob(csvString, 'text/csv');
      const today = new Date().toISOString().split("T")[0];
      blob.setName(`${groupFileName} ${today}.csv`);
      blob = Utilities.zip([blob]).setName(`${groupFileName}.zip`);
      const file = folder.createFile(blob);

      files.push(file);
    }
  }

  uploadMergedAttachments(folder, attachments);
  parseFileRecipients(files);

  // Returns array of `File`s
  return files;
}

function parseFileRecipients(files) {
  const recipients = {
    'All Unlimited Access eBooks list for Bookstore.zip': ['engel653@umn.edu'],
  };

  for (const file of files) {
    const emails = recipients[file.getName()];
    if (emails) {
      for (const email of emails) shareAndNotifyRecipient(file, email);
    }
  }
}

function shareAndNotifyRecipient(file, email) {
  file.addViewer(email);

  var body = '<p>The following report is ready for download in Google Drive:</p>';
  body += `<p><a href="${file.getUrl()}">${file.getName()}</a></p>`;
  body += '<p>If you have questions about this email, please contact <a href="mailto:engel653@umn.edu">engel653@umn.edu</a>.</p>'

  MailApp.sendEmail({
    to: email,
    subject: `Report ready: ${file.getName()}`,
    htmlBody: body
  });
  console.log(`Emailed ${file.getName()} to ${email}`);
}
