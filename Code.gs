// קבועים
const SPREADSHEET_ID = '1uBCgPXqdsWXnds2x6MzwwFte7GSEx62HtNaFldaFIao';
const SHEET_NAME = 'Moti';
const DEFAULT_EMAIL = '7691037@gmail.com';

// יצירת דף הבית של האפליקציה
function doGet() {
  return HtmlService.createTemplateFromFile('Index')
    .evaluate()
    .setTitle('מערכת הזמנות לקופות צדקה')
    .setFaviconUrl('https://www.google.com/images/icons/product/drive-2020q4-32dp.png')
    .addMetaTag('viewport', 'width=device-width, initial-scale=1');
}

// פונקציה להכללת קבצים אחרים
function include(filename) {
  return HtmlService.createHtmlOutputFromFile(filename).getContent();
}

// פונקציה לקבלת כל המוצרים מהגיליון
function getProducts() {
  try {
    Logger.log('מתחיל לקרוא מוצרים מהגיליון');
    
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName(SHEET_NAME);
    if (!sheet) {
      Logger.log('שגיאה: לא נמצא גיליון בשם ' + SHEET_NAME);
      return [];
    }
    
    Logger.log('נמצא גיליון: ' + sheet.getName());
    const data = sheet.getDataRange().getValues();
    Logger.log('נתונים מהגיליון:', data);
    
    if (data.length <= 1) {
      Logger.log('אין מספיק נתונים בגיליון');
      return [];
    }
    
    // קבלת כל התמונות מהגיליון
    const images = sheet.getImages();
    Logger.log('מספר תמונות שנמצאו:', images.length);
    
    const imageMap = new Map();
    
    // מיפוי התמונות לפי מיקום
    images.forEach((image, index) => {
      try {
        const row = image.getAnchorRow();
        const col = image.getAnchorColumn();
        Logger.log(`תמונה ${index + 1} נמצאת בשורה ${row + 1}, עמודה ${col + 1}`);
        
        if (col === 1) { // עמודה B
          const blob = image.getBlob();
          Logger.log(`סוג התמונה: ${blob.getContentType()}, גודל: ${blob.getBytes().length} bytes`);
          const base64Data = Utilities.base64Encode(blob.getBytes());
          const contentType = blob.getContentType();
          const dataUrl = `data:${contentType};base64,${base64Data}`;
          imageMap.set(row + 1, dataUrl);
          Logger.log(`תמונה ${index + 1} נוספה למיפוי עבור שורה ${row + 1}`);
        }
      } catch (imageError) {
        Logger.log(`שגיאה בעיבוד תמונה ${index + 1}:`, imageError);
      }
    });
    
    Logger.log('מספר תמונות שמופו:', imageMap.size);
    
    const products = [];
    
    // דילוג על שורת הכותרות
    for (let i = 1; i < data.length; i++) {
      const row = data[i];
      Logger.log(`מעבד שורה ${i + 1}:`, row);
      
      // בדיקה שהשורה לא ריקה
      if (row.some(cell => cell !== '')) {
        const imageUrl = imageMap.get(i + 1);
        Logger.log(`URL תמונה לשורה ${i + 1}:`, imageUrl ? 'נמצא' : 'לא נמצא');
        
        const product = {
          sku: row[0] || '', // עמודה A - מק"ט
          image: imageUrl || 'https://via.placeholder.com/200x200?text=אין+תמונה',
          description: row[2] || 'ללא תיאור', // עמודה C - תיאור
          regularPrice: Number(row[3]) || 0, // עמודה D - מחיר רגיל
          notes: row[4] || '', // עמודה E - הערות
          fundPrice: Number(row[5]) || 0, // עמודה F - מחיר לקופה
          agentPrice: Number(row[6]) || 0 // עמודה G - מחיר סוכן
        };
        
        Logger.log('מוצר חדש:', product);
        products.push(product);
      }
    }
    
    Logger.log('סה"כ מוצרים:', products.length);
    return products;
    
  } catch (error) {
    Logger.log('שגיאה בקבלת המוצרים:', error.toString());
    Logger.log('Stack trace:', error.stack);
    return [];
  }
}

// פונקציה לשמירת הזמנה
function submitOrder(orderData) {
  try {
    const sheet = SpreadsheetApp.openById(SPREADSHEET_ID).getSheetByName('הזמנות');
    if (!sheet) {
      SpreadsheetApp.openById(SPREADSHEET_ID).insertSheet('הזמנות');
    }
    
    const timestamp = new Date();
    const rowData = [
      timestamp,
      orderData.firstName,
      orderData.lastName,
      orderData.fundNumber,
      orderData.fundName,
      JSON.stringify(orderData.items),
      orderData.saleFormat,
      orderData.totalAmount
    ];
    
    sheet.appendRow(rowData);
    
    // שליחת אימייל אישור
    sendConfirmationEmail(orderData);
    
    return { success: true, message: 'ההזמנה נשלחה בהצלחה!' };
  } catch (error) {
    return { success: false, message: 'אירעה שגיאה: ' + error.toString() };
  }
}

// פונקציה לשליחת אימייל אישור
function sendConfirmationEmail(orderData) {
  const emailBody = `
    שלום ${orderData.firstName} ${orderData.lastName},
    
    הזמנתך התקבלה בהצלחה!
    
    פרטי ההזמנה:
    קופת צדקה: ${orderData.fundName}
    מספר עמותה: ${orderData.fundNumber}
    
    פריטים שהוזמנו:
    ${formatOrderItems(orderData.items)}
    
    סה"כ לתשלום: ${orderData.totalAmount} ₪
    
    תודה רבה!
  `;
  
  MailApp.sendEmail({
    to: Session.getActiveUser().getEmail(),
    subject: 'אישור הזמנה - מערכת הזמנות לקופות צדקה',
    body: emailBody
  });
}

// פונקציית עזר לפורמט פריטי ההזמנה
function formatOrderItems(items) {
  return items.map(item => 
    `${item.description} - ${item.quantity} יחידות, מחיר ליחידה: ${item.price} ₪`
  ).join('\n');
}