// Reading the barcode on the back of a book.
//
// Two ways in. Chromium on Android (which is what the APK runs inside) has a
// native BarcodeDetector, and it is much faster and lighter than anything we
// could ship. Everywhere else falls back to ZXing, downloaded only at the
// moment someone actually scans so it never costs the rest of the app anything.
//
// The camera needs a secure context, so over plain HTTP on the LAN a browser
// gives us nothing. cameraAvailable() reports that honestly and the UI hides
// the scan button rather than offering something that cannot work.

export const cameraAvailable = () => !!navigator.mediaDevices?.getUserMedia;

// Book barcodes are EAN-13 in the 978/979 range. The scanners already verify
// the checksum, so a prefix check is enough to ignore the coffee mug on the desk.
const looksLikeIsbn = (code) => /^97[89]\d{10}$/.test(String(code || '').replace(/\D/g, ''));

export async function startScanner(video, onIsbn, onError) {
  const stream = await navigator.mediaDevices.getUserMedia({
    video: { facingMode: { ideal: 'environment' }, width: { ideal: 1280 } },
    audio: false,
  });

  let stopped = false;
  let controls = null;
  const stop = () => {
    if (stopped) return;
    stopped = true;
    try { controls?.stop(); } catch {}
    for (const track of stream.getTracks()) track.stop();
    video.srcObject = null;
  };
  const hit = (code) => {
    if (stopped) return;
    const isbn = String(code).replace(/\D/g, '');
    if (!looksLikeIsbn(isbn)) return;
    stop();
    onIsbn(isbn);
  };

  video.srcObject = stream;
  video.setAttribute('playsinline', 'true');
  await video.play().catch(() => {});
  if (stopped) { stop(); return stop; }

  const Detector = window.BarcodeDetector;
  const native = Detector && await Detector.getSupportedFormats?.().then(
    (f) => f.includes('ean_13'), () => false);

  if (native) {
    const detector = new Detector({ formats: ['ean_13'] });
    const tick = async () => {
      if (stopped) return;
      try {
        for (const code of await detector.detect(video)) hit(code.rawValue);
      } catch { /* a frame that will not decode is normal, keep going */ }
      if (!stopped) setTimeout(tick, 200);
    };
    tick();
    return stop;
  }

  try {
    const { BrowserMultiFormatOneDReader } = await import('@zxing/browser');
    if (stopped) return stop;
    const reader = new BrowserMultiFormatOneDReader();
    controls = await reader.decodeFromStream(stream, video, (result) => {
      if (result) hit(result.getText());
    });
  } catch {
    stop();
    onError?.("This browser can't read barcodes. You can type the ISBN instead.");
  }
  return stop;
}
