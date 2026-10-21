export function createDictationPlayer({ chunks, onState, onError, createAudio = source => new Audio(source), delay = 4000 }) {
  let index = 0;
  let timer;
  let watchdog;
  let generation = 0;
  let current;
  let status = "idle";
  let automatic = false;

  const notify = next => { status = next; onState({ status, index, total: chunks.length }); };
  const stop = () => {
    generation++;
    clearTimeout(timer);
    clearTimeout(watchdog);
    if (current) {
      current.pause();
      current.removeAttribute("src");
      current.load();
      current = undefined;
    }
    notify("idle");
  };
  function fail(message) {
    stop();
    onError(message);
  }
  function speak(selected, rate, all) {
    stop();
    index = selected;
    automatic = all;
    const token = generation;
    function readChunk() {
      if (token !== generation) return;
      try {
        current = createAudio(chunks[index].audio);
        current.playbackRate = rate;
        const guard = () => { if (token === generation) fail("El audio no está respondiendo. Comprueba tu conexión y pulsa Play para reintentar."); };
        watchdog = setTimeout(guard, 15000);
        current.onplaying = () => {
          if (token !== generation) return;
          clearTimeout(watchdog);
          watchdog = setTimeout(guard, 60000);
          notify("speaking");
        };
        current.onerror = () => {
          if (token !== generation) return;
          fail("No se pudo cargar el audio del dictado. Comprueba tu conexión y vuelve a pulsar Play, o pide a un adulto que lo lea.");
        };
        current.onended = () => {
          if (token !== generation) return;
          clearTimeout(watchdog);
          current = undefined;
          if (!automatic || index === chunks.length - 1) { notify("finished"); return; }
          notify("waiting");
          timer = setTimeout(() => { index++; readChunk(); }, delay);
        };
        notify("starting");
        current.play().catch(error => {
          if (token === generation) fail(`No se pudo iniciar el audio (${error.name}). Pulsa «Repetir fragmento» o Play para escucharlo.`);
        });
      } catch (error) {
        if (token === generation) fail(`No se pudo iniciar el audio: ${error.message}`);
      }
    }
    readChunk();
  }
  return {
    play(rate) { speak(0, rate, true); },
    repeat(rate) { speak(index, rate, false); },
    next(rate) { speak(Math.min(index + 1, chunks.length - 1), rate, false); },
    stop,
    get status() { return status; },
    get index() { return index; },
  };
}
