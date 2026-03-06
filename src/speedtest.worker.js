 

self.onmessage = async (e) => {
  const { type, payload } = e.data;

  if (type === 'START_DOWNLOAD') {
    const { url, streams, duration } = payload;
    const streamBytes = new Array(streams).fill(0);
    const startDown = performance.now();
    let isAborted = false;

    // Reporting interval
    const reportInterval = setInterval(() => {
      const totalBytes = streamBytes.reduce((a, b) => a + b, 0);
      self.postMessage({ type: 'DOWNLOAD_PROGRESS', totalBytes });
      
      if ((performance.now() - startDown) / 1000 > duration) {
        isAborted = true;
        clearInterval(reportInterval);
        self.postMessage({ type: 'DOWNLOAD_COMPLETE' });
      }
    }, 250);

    // Launch parallel streams
    for (let i = 0; i < streams; i++) {
      (async () => {
        while (!isAborted) {
          try {
            const cacheBuster = Math.random().toString(36).slice(2);
            const res = await fetch(`${url}?bytes=${50 * 1024 * 1024}&s=${i}&r=${cacheBuster}`, { cache: 'no-store' });
            if (!res.body) break;
            const reader = res.body.getReader();
            
            while (!isAborted) {
              const { done, value } = await reader.read();
              if (done || isAborted) {
                if (isAborted) reader.cancel();
                break;
              }
              streamBytes[i] += value.length;
            }
          } catch (err) {
            // Ignore fetch errors during aborts
          }
        }
      })();
    }
  }

  if (type === 'START_UPLOAD') {
    const { url, streams, duration } = payload;
    const startUp = performance.now();
    let totalUploadedBytes = 0;
    let isAborted = false;

    // 25MB chunks
    const UP_CHUNK_SIZE = 25 * 1024 * 1024;
    const uploadData = new Uint8Array(UP_CHUNK_SIZE);
    crypto.getRandomValues(uploadData);

    const reportInterval = setInterval(() => {
      self.postMessage({ type: 'UPLOAD_PROGRESS', totalBytes: totalUploadedBytes });
      
      if ((performance.now() - startUp) / 1000 > duration) {
        isAborted = true;
        clearInterval(reportInterval);
        self.postMessage({ type: 'UPLOAD_COMPLETE' });
      }
    }, 250);

    for (let i = 0; i < streams; i++) {
      (async () => {
        while (!isAborted) {
          await new Promise((resolve) => {
            const xhr = new XMLHttpRequest();
            let lastLoaded = 0;
            
            xhr.upload.onprogress = (event) => {
               if (isAborted) {
                  xhr.abort();
                  return resolve();
               }
               const delta = event.loaded - lastLoaded;
               totalUploadedBytes += delta;
               lastLoaded = event.loaded;
            };
            
            const cleanupXHR = () => resolve();
            xhr.onload = cleanupXHR;
            xhr.onerror = cleanupXHR;
            xhr.onabort = cleanupXHR;
            
            const cacheBuster = Math.random().toString(36).slice(2);
            xhr.open('POST', `${url}?r=${cacheBuster}`);
            xhr.send(uploadData);

            // Periodically check for abort to break hanging XHRs
            const checkAbort = setInterval(() => {
              if (isAborted) {
                xhr.abort();
                clearInterval(checkAbort);
                resolve();
              }
            }, 100);
            
            xhr.addEventListener('loadend', () => clearInterval(checkAbort));
          });
        }
      })();
    }
  }
};
