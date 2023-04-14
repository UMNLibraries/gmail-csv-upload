function pivotInstructors() {
  // Paste Folder ID below
  const folder = DriveApp.getFolderById('');
  // Paste Sheet ID below
  const sheetId = '';

  let emailsFile1 = folder.getFilesByName('Course instructors (all emails) [INST-UPLOAD-1].csv');

  if (emailsFile1.hasNext()) {
    emailsFile1 = emailsFile1.next();
  } else return;

  const emailsFile2 = folder.getFilesByName('Course instructors (all emails) [INST-UPLOAD-2].csv').next();

  const instructorsCsv = Utilities.parseCsv(
    folder.getFilesByName('Course instructors by semester [INST-UPLOAD].csv')
      .next().getBlob().getDataAsString()
  );
  const emailsCsv = Utilities.parseCsv(emailsFile1.getBlob().getDataAsString())
    .concat(Utilities.parseCsv(emailsFile2.getBlob().getDataAsString()).slice(1));

  const headers = instructorsCsv.splice(0, 1)[0];
  headers.push('Last Name', 'First Name', 'Preferred Email');

  let pivot = [];

  const emailIndex = emailsCsv.map(row => row[0]);

  console.log('Begin email search');
  for (const row of instructorsCsv) {
    row[2] = row[2].split('; ');

    for (const primaryId of row[2]) {
      if (primaryId.slice(0, 2) !== 'SA') continue;

      const newRow = [row[0], row[1], primaryId];
      newRow.push(...emailsCsv[emailIndex.indexOf(primaryId)].slice(1));
      pivot.push(newRow);
    }
  }
  console.log('End email search');

  // Delete "all emails" files
  emailsFile1.setTrashed(true);
  emailsFile2.setTrashed(true);

  // Deduplicate
  const seen = new Set();
  pivot = pivot.filter(item => {
    const concat = item[0] + item[1] + item[2];
    return seen.has(concat) ? false : seen.add(concat);
  });

  pivot.unshift(headers);

  const sheet = SpreadsheetApp.openById(sheetId).getSheets()[0];
  writeToSheet(sheet, pivot);
  filterCurrentSemester(sheet);
}

function writeToSheet(sheet, data) {
  if (sheet.getFilter()) sheet.getFilter().remove();
  sheet.deleteRow(1);
  sheet.clear();
  sheet.getRange(1, 1, data.length, data[0].length).setValues(data);
  sheet.getRange(1, 1, data.length, data[0].length).createFilter();
  
  sheet.insertRowBefore(1);
  sheet.getRange(1, 1).setValue('Alma\'s course year values for Spring and Summer match the year in which the Autumn/Fall term began, which is one less than the year values that the UMN uses for those semesters. For example, the semester from January-May 2023 is "Spring 2022" here, but "Spring 2023" at the UMN.');
  sheet.getRange(1, 1, 1, 6).merge().setWrap(true)
    .setFontColor('yellow').setBackground('gray');
}

function filterCurrentSemester(sheet) {
  const filter = sheet.getFilter();

  let semester = '';
  const curMonth = new Date().getMonth() + 1;
  if (curMonth >= 9 && curMonth <= 12) {
    semester = 'Autumn';
  } else if (curMonth >= 1 && curMonth <= 4) {
    semester = 'Spring';
  } else if (curMonth >= 5 && curMonth <= 8) {
    semester = 'Summer';
  }
  const excludedSemesters = Array.from(new Set(
    sheet.getSheetValues(3, 2, -1, 1).map(s => s[0]).filter(s => s !== semester)
  ));
  const semesterCriteria = SpreadsheetApp.newFilterCriteria()
    .setHiddenValues(excludedSemesters).build();
  filter.setColumnFilterCriteria(2, semesterCriteria);

  let year = new Date().getFullYear();
  switch (semester) {
    case 'Autumn':
      year = year;
      break;
    case 'Spring':
      year = year - 1;
      break;
    case 'Summer':
      year = year - 1;
      break;
    default:
      console.error('Invalid semester');
  }
  const excludedYears = Array.from(new Set(
    sheet.getSheetValues(3, 1, -1, 1).map(y => y[0]).filter(y => y !== year)
  ));
  const yearCriteria = SpreadsheetApp.newFilterCriteria()
    .setHiddenValues(excludedYears).build();
  filter.setColumnFilterCriteria(1, yearCriteria);
}