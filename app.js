require('dotenv').config();
const express = require('express');
const bodyParser = require('body-parser');
const fs = require('fs');
const ftp = require('basic-ftp');
const csvParser = require('csv-parser');

const app = express();
app.use(bodyParser.json());

const PORT = process.env.PORT || 3000;

// Carica il file con EAN13 -> ID prodotto/colore/taglia
let coloriProdottiTaglie = [];

fs.createReadStream('colori_prodotti_taglie.csv')
  .pipe(csvParser({ separator: ';' }))
  .on('data', (row) => coloriProdottiTaglie.push(row))
  .on('end', () => console.log('✔️ File ColoriProdottiTaglie caricato'));

// Funzione per incrociare EAN13
const findProductByEAN = (ean13) => {
  return coloriProdottiTaglie.find(r => r.EAN13 === ean13);
};

// Webhook listener
app.post('/webhook', async (req, res) => {
  const orderData = req.body;

  console.log('📦 Ricevuto ordine:', JSON.stringify(orderData, null, 2));

  if (!orderData || !orderData.record_T || !orderData.record_C || !orderData.records_R) {
    console.error('❌ Payload incompleto o errato:', JSON.stringify(orderData, null, 2));
    return res.status(400).send('Payload incompleto');
  }

  const ordineId = orderData.record_T["Vostro ID ordine"];
  const record_T = orderData.record_T;
  const record_C = orderData.record_C;
  const records_R = orderData.records_R;

  const fileNameTmp = `output/Ord_${ordineId}.tmp`;
  const fileNameCsv = `output/Ord_${ordineId}.csv`;

  const writeStream = fs.createWriteStream(fileNameTmp, { encoding: 'utf-8' });

  try {
    const dataOrdine = record_T["Data ordine"].replace(/-/g, '');
    const oraOrdine = record_T["Ora ordine"].replace(/:/g, '');

    // ✅ RECORD T - Testata Ordine
    writeStream.write(
      `T;${ordineId};${ordineId};${dataOrdine};${oraOrdine};${record_T["Vostro ID cliente"]};K;1000020;;${record_T["Spese spedizione"]};${record_T["Importo totale vendita"]};0;;false\r\n`
    );

    // ✅ RECORD C - Cliente
    writeStream.write(
      `C;${record_C["Vostro ID cliente"]};${record_C["Cognome"]};${record_C["Nome"]};${record_C["Ragione sociale società"] || ''};${record_C["Indirizzo"]};${record_C["CAP"]};${record_C["Città"]};${record_C["Provincia"]};${record_C["Nazione"]};${record_C["E-mail"]};${record_C["Telefono"]};;;;;;;;;;;\r\n`
    );

    // ✅ RECORD R - Righe Ordine
    records_R.forEach((riga, index) => {
      const numeroRiga = index + 1;
      const idRigaOrdineUnivoco = `${ordineId}${numeroRiga}`;
    
      const prodotto = findProductByEAN(riga.SKU);
    
      if (!prodotto) {
        console.log(`❌ SKU ${riga.SKU} non trovato nel CSV`);
        return;
      }
    
      writeStream.write(
        `R;${ordineId};${idRigaOrdineUnivoco};${numeroRiga};${prodotto["id prodotto"].trim()};${prodotto["id colore"].trim()};${prodotto["id taglia"].trim()};${riga["Quantità ordinata"].toString().trim()};${riga["Prezzo unitario"].toString().trim()};;;0\r\n`
      );
    });
    
    // ✅ Chiudo il file
    writeStream.end();

    writeStream.on('finish', async () => {
      fs.renameSync(fileNameTmp, fileNameCsv);
      console.log(`✔️ File ${fileNameCsv} pronto per l'upload`);

      const client = new ftp.Client();
      try {
        await client.access({
          host: process.env.FTP_HOST,
          user: process.env.FTP_USER,
          password: process.env.FTP_PASS
        });

        console.log('🔗 Connesso a FTP');
        await client.uploadFrom(fileNameCsv, `${process.env.FTP_FOLDER}/Ord_${ordineId}.csv`);
        console.log('🚀 Upload completato');
      } catch (ftpError) {
        console.error('❌ Errore FTP:', ftpError);
      } finally {
        client.close();
      }
    });

    res.status(200).send('Ordine ricevuto e processato');
  } catch (error) {
    console.error('❌ Errore generale:', error);
    res.status(500).send('Errore durante il processo');
  }
});

app.listen(PORT, () => console.log(`🚀 Server webhook in ascolto su porta ${PORT}`));
