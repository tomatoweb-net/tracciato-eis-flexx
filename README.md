# Tracciato EIS Flexx

Servizio webhook per la gestione degli ordini e-commerce con generazione del tracciato CSV secondo le specifiche EIS.

## Installazione

```bash
npm install
```

## Configurazione

Creare un file `.env` nella root del progetto con le seguenti variabili:

```env
PORT=3000
FTP_HOST=ftp.example.com
FTP_USER=username
FTP_PASS=password
FTP_FOLDER=/cartella/destinazione
```

## Utilizzo

1. Avviare il server:
```bash
node app.js
```

2. Il servizio espone un endpoint webhook su `/webhook` che accetta richieste POST
3. Per ogni ordine ricevuto, viene generato un file CSV nel formato richiesto
4. Il file viene automaticamente caricato via FTP nella cartella configurata

## Formato CSV

### Record T (Testata)
```
T;ordineId;ordineId;dataOrdine;oraOrdine;idCliente;K;;1000020;speseSpedizione;importoTotale;0;;false
```

### Record C (Cliente)
```
C;idCliente;cognome;nome;ragioneSociale;indirizzo;cap;citta;provincia;nazione;email;telefono;;;;;;;;;;
```

### Record R (Righe)
```
R;ordineId;idRigaOrdineUnivoco;numeroRiga;idProdotto;idColore;idTaglia;quantita;prezzo;;;0
```

## Dipendenze

- express
- dotenv
- basic-ftp
- csv-parser 