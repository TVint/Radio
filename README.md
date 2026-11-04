# 📻 CLANDESTINE PIRATE WEB RADIO & CASSETTE ARCHIVE

Interfaccia web interattiva per archivio radio e mixtape underground con motore audio **Web Audio API** (Vanilla JavaScript, zero dipendenze esterne):

## 🎛️ Le Due Interfacce

1. 📻 **SHARP GF-9494 STEREO BOOMBOX (`index.html`)**
   - Fedele riproduzione del leggendario ghettoblaster giapponese anni '80 (Sharp GF-9494).
   - **Doppi VU meter analogici ad ago** retroilluminati con oscillazione indipendente sui canali stereo Left & Right via `ChannelSplitterNode`.
   - **Meccanismo a cassetta**: sportello acrilico, bobine magnetiche che ruotano durante il play, contanastri meccanico a 3 cifre `[ 0 0 0 ]` funzionante con tasto di reset.
   - **Sistema APLD (Auto Program Locate Device)**: tasti numerati da 1 a 7 per saltare tra i mixtape dell'archivio.
   - **Scala di sintonia radio analogica** (FM, SW1, SW2, AM) con cursore a linea rossa interattivo ed effetto sonoro statico di sintonia.
   - **Altoparlanti a 2 vie**: woofer che pulsano e vibrano fisicamente a ritmo di sub-bass e griglia metallica forata.
   - Tasti meccanici superiori (REC, REW, FF, PLAY, STOP, PAUSE) con feedback sonoro clunk e LED di stato (Power, Mixing, FM Stereo).

2. 📺 **RADIOFAX // TELEVIDEO ARCHIVE (`televideo.html`)**
   - Interfaccia brutalista in stile **Televideo / Teletext (Ceefax)** a 25fps con scanlines CRT.
   - Griglia archivio a 2 colonne con 20 mixtape cliccabili.
   - VU meter ASCII (`██████████▒▒▒▒▒`) + striscia a 16 LED.
   - Oscilloscopio SVG vettoriale in tempo reale nel dominio del tempo.
   - Tasti colorati Fastext (Rosso: Play, Verde: Stop, Giallo: Next, Ciano: Synth Test).

---

## 🎧 Audio Engine & Tracce

- Carica `test-track.mp3` in locale tramite `<audio>` tag e lo instrada attraverso i nodi Web Audio API.
- In caso di assenza del file o restrizioni locali, il motore include un sintetizzatore stereo 4/4 a 124 BPM generativo per testare subito l'escursione dei woofer e l'oscillazione dei VU meter.
