(() => {
  const STORAGE_KEY = 'minimax-h3-prompt-generator-v1';
  const LIBRARY_KEY = 'minimax-h3-prompt-library-v1';
  const $ = (selector, root = document) => root.querySelector(selector);
  const $$ = (selector, root = document) => [...root.querySelectorAll(selector)];
  const uid = () => `${Date.now().toString(36)}${Math.random().toString(36).slice(2, 7)}`;
  const esc = value => String(value || '').replace(/[&<>"']/g, char => ({ '&':'&amp;', '<':'&lt;', '>':'&gt;', '"':'&quot;', "'":'&#39;' })[char]);
  const field = (label, key, value = '', options = {}) => {
    const type = options.type || 'textarea'; const attrs = options.attrs || '';
    const control = type === 'select'
      ? `<div class="select is-fullwidth"><select data-key="${key}" ${attrs}>${options.options.map(o => `<option value="${esc(o.value)}" ${o.value === value ? 'selected' : ''}>${esc(o.label)}</option>`).join('')}</select></div>`
      : type === 'input' ? `<input class="input" data-key="${key}" value="${esc(value)}" ${attrs}>`
      : `<textarea class="textarea" data-key="${key}" rows="${options.rows || 2}" ${attrs}>${esc(value)}</textarea>`;
    return `<div class="field"><label class="label is-small">${label}</label><div class="control">${control}</div>${options.help ? `<p class="help">${options.help}</p>` : ''}</div>`;
  };
  const defaultState = () => ({
    mode: 't2va', duration: '8', soundscape: '', music: '', fullSummary: '', fullStyle: '', taskTypes: ['reference generation'],
    keyframes: [{ id: uid(), description: '' }],
    shots: [{ id: uid(), cutTime: '', styleComposition: '', action: '', cameraType: '', amplitude: '', speed: '', detail: '', dialogues: [], texts: [], sounds: [] }],
    refs: { subject: [], picture: [], video: [], audio: [] }
  });
  const clone = value => JSON.parse(JSON.stringify(value));
  const safeFilename = name => (name || 'minimax-h3-prompt').replace(/[^a-z0-9_-]+/gi, '-').replace(/^-+|-+$/g, '').toLowerCase() || 'minimax-h3-prompt';
  function normalizeState(candidate) {
    const next = { ...defaultState(), ...(candidate || {}) };
    next.refs ||= { subject: [], picture: [], video: [], audio: [] };
    ['subject','picture','video','audio'].forEach(k => next.refs[k] ||= []);
    next.shots ||= []; next.keyframes ||= []; next.taskTypes ||= ['reference generation'];
    return next;
  }
  function makePrompt(name, promptState = defaultState()) {
    const now = new Date().toISOString();
    return { id: uid(), name: String(name || '').trim() || 'Untitled prompt', createdAt: now, updatedAt: now, state: normalizeState(promptState) };
  }
  function loadLibrary() {
    try {
      const saved = JSON.parse(localStorage.getItem(LIBRARY_KEY));
      if (saved?.prompts?.length) {
        saved.prompts = saved.prompts.map(prompt => ({ ...prompt, state: normalizeState(prompt.state) }));
        saved.activePromptId = saved.prompts.some(prompt => prompt.id === saved.activePromptId) ? saved.activePromptId : saved.prompts[0].id;
        return saved;
      }
    } catch { /* Create a new library below. */ }
    try {
      const legacy = JSON.parse(localStorage.getItem(STORAGE_KEY));
      if (legacy) {
        const imported = makePrompt('Imported draft', legacy);
        return { activePromptId: imported.id, prompts: [imported] };
      }
    } catch { /* Start with a blank prompt. */ }
    const first = makePrompt('Untitled prompt');
    return { activePromptId: first.id, prompts: [first] };
  }
  let library = loadLibrary();
  let state = library.prompts.find(prompt => prompt.id === library.activePromptId).state;
  localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));

  const modes = {
    t2va: 'Build a complete audiovisual timeline from text.',
    i2va: 'Anchor Picture 1 to the first frame and develop forward.',
    fl2va: 'Anchor Picture 1 at the start and Picture 2 at the final frame.',
    l2va: 'Develop toward Picture 1 as the final frame.',
    full: 'Use labeled reference assets, retention analysis, and six output sections.'
  };
  const taskOptions = ['keyframe completion','reference generation','video editing','video continuation','audio reuse','audio reference'];
  const refConfig = {
    subject: { title: 'Subjects', label: 'Subject', placeholder: 'The young woman from Picture 1, with long dark hair, a blue cardigan, and a thin silver necklace.', relations: ['fully_preserved','partially_preserved','attribute_transfer','weak_reference'] },
    picture: { title: 'Pictures', label: 'Picture', placeholder: 'The first frame of [Shot 1], showing a woman seated beside a café window.', relations: ['fully_preserved','partially_preserved','attribute_transfer','weak_reference'] },
    video: { title: 'Videos', label: 'Video', placeholder: 'The source video for the target video edit.', relations: ['fully_preserved','partially_preserved','attribute_transfer','weak_reference'] },
    audio: { title: 'Audio', label: 'Audio', placeholder: 'The voice-timbre reference for Subject 1 (S1).', relations: ['fully_copy','partially_copy','reference','weak_reference'] }
  };

  function syncFormState() {
    state.mode = $('#mode').value; state.duration = $('#duration').value; state.soundscape = $('#soundscape').value; state.music = $('#music').value;
    state.fullSummary = $('#full-summary').value; state.fullStyle = $('#full-style').value;
  }
  function activePrompt() { return library.prompts.find(prompt => prompt.id === library.activePromptId); }
  function saveLibrary() {
    const prompt = activePrompt();
    prompt.state = state;
    prompt.updatedAt = new Date().toISOString();
    localStorage.setItem(LIBRARY_KEY, JSON.stringify(library));
  }
  function saveAndRender() { syncFormState(); saveLibrary(); renderOutput(); }
  function renderPromptManager() {
    const active = activePrompt();
    $('#prompt-library').innerHTML = library.prompts.map(prompt => `<option value="${esc(prompt.id)}" ${prompt.id === active.id ? 'selected' : ''}>${esc(prompt.name)}</option>`).join('');
    $('#prompt-name').value = active.name;
    $('#delete-prompt').disabled = library.prompts.length === 1;
    $('#prompt-library-status').textContent = `${library.prompts.length} saved prompt${library.prompts.length === 1 ? '' : 's'} stored locally. Changes to “${active.name}” save automatically.`;
  }
  function setLibraryStatus(message) { $('#prompt-library-status').textContent = message; }
  function reindex() {
    state.shots.forEach((shot, index) => { shot.number = index + 1; });
    state.keyframes.forEach((frame, index) => { frame.number = index + 1; });
    Object.values(state.refs).forEach(entries => entries.forEach((entry, index) => { entry.number = index + 1; }));
  }
  function renderSettings() {
    $('#mode').value = state.mode; $('#duration').value = state.duration; $('#soundscape').value = state.soundscape; $('#music').value = state.music;
    $('#full-summary').value = state.fullSummary; $('#full-style').value = state.fullStyle;
    $('#mode-help').textContent = modes[state.mode];
    const keyframeModes = ['i2va','fl2va','l2va'].includes(state.mode);
    $('#keyframes-section').classList.toggle('is-visible', keyframeModes);
    $('#full-reference-section').classList.toggle('is-visible', state.mode === 'full');
    $('#task-types').innerHTML = taskOptions.map(type => `<label class="checkbox mr-4"><input type="checkbox" data-task-type="${type}" ${state.taskTypes.includes(type) ? 'checked' : ''}> ${type}</label>`).join('');
  }
  function renderKeyframes() {
    const needed = state.mode === 'fl2va' ? 2 : 1;
    while (state.keyframes.length < needed) state.keyframes.push({ id: uid(), description: '' });
    $('#keyframes').innerHTML = state.keyframes.slice(0, needed).map((frame, i) => `<article class="card editor-card"><div class="card-content"><div class="entry-title"><h3 class="title is-6">Picture ${i + 1}</h3></div>${field('Reference description', 'description', frame.description, { help: i === 0 ? 'Use this label in the timeline when it anchors a shot.' : 'This is the ending reference image.' })}</div></article>`).join('');
  }
  function renderReferenceGroups() {
    $('#reference-groups').innerHTML = Object.entries(refConfig).map(([kind, config]) => {
      const items = state.refs[kind];
      return `<section class="box"><div class="entry-title"><div><h2 class="title is-5 mb-1">${config.title}</h2><p class="help">Create a separately tracked ${config.label.toLowerCase()} reference.</p></div><button class="button is-link is-light" data-action="add-ref" data-kind="${kind}" type="button">Add ${config.label}</button></div><div class="mt-4">${items.length ? items.map((item, index) => referenceCard(kind, item, index)).join('') : '<div class="empty-list">No references added yet.</div>'}</div></section>`;
    }).join('');
  }
  function referenceCard(kind, item, index) {
    const config = refConfig[kind];
    const relOptions = config.relations.map(value => ({ value, label: value }));
    return `<article class="card editor-card mb-4" data-ref-id="${item.id}" data-kind="${kind}"><div class="card-content"><div class="entry-title"><h3 class="title is-6">&lt;${config.label} ${index + 1}&gt;</h3><button class="button is-small is-danger is-light" type="button" data-action="remove-ref" data-kind="${kind}" data-id="${item.id}">Remove</button></div>${field('Definition', 'definition', item.definition || '', { rows: 2, attrs: `data-ref-field="definition"`, help: config.placeholder })}${field('Where it appears / applies', 'appears', item.appears || '', { type: 'input', attrs: 'data-ref-field="appears"', help: 'Example: [Shot 1], [Shot 3], or cut and pacing structure.' })}${field('Retention relationship', 'relationship', item.relationship || config.relations[0], { type: 'select', options: relOptions, attrs: 'data-ref-field="relationship"' })}${field('Retention detail', 'retention', item.retention || '', { rows: 2, attrs: 'data-ref-field="retention"', help: 'State how the referenced content is preserved, copied, transferred, or used.' })}</div></article>`;
  }
  function renderShots() {
    $('#shots').innerHTML = state.shots.length ? state.shots.map((shot, index) => shotCard(shot, index)).join('') : '<div class="empty-list">No shots. Add a shot to begin the timeline.</div>';
  }
  function shotCard(shot, index) {
    const selectOptions = (items, none = 'Not specified') => [{ value: '', label: none }, ...items.map(v => ({ value: v, label: v }))];
    const cameras = ['Zoom In','Zoom Out','Push In','Pull Out','Pan Left','Pan Right','Truck Left','Truck Right','Tilt Up','Tilt Down','Pedestal Up','Pedestal Down','Arc Shot','Tracking Shot','Static Shot','Shake Slightly','Shake Strongly','POV','Roll Clockwise','Roll Counterclockwise'];
    return `<article class="card editor-card" data-shot-id="${shot.id}"><div class="card-content"><div class="entry-title"><h3 class="title is-5">Shot ${index + 1}</h3><div class="buttons are-small"><button class="button" type="button" data-action="move-shot" data-id="${shot.id}" data-direction="-1" ${index === 0 ? 'disabled' : ''}>↑</button><button class="button" type="button" data-action="move-shot" data-id="${shot.id}" data-direction="1" ${index === state.shots.length - 1 ? 'disabled' : ''}>↓</button><button class="button is-danger is-light" type="button" data-action="remove-shot" data-id="${shot.id}">Remove</button></div></div><div class="columns is-multiline"><div class="column is-4">${index ? field('Cut time', 'cutTime', shot.cutTime, { type: 'input', attrs: 'data-shot-field="cutTime" placeholder="00:03.500"' }) : '<div class="notification is-light is-size-7">Opening shot: no timestamp.</div>'}</div><div class="column is-8">${field('Style and initial composition', 'styleComposition', shot.styleComposition, { rows: 3, attrs: 'data-shot-field="styleComposition"', help: 'For Shot 1, establish style and composition. In full-reference mode, cite labels naturally.' })}</div><div class="column is-12">${field('Action, reaction, and progression', 'action', shot.action, { rows: 3, attrs: 'data-shot-field="action"' })}</div><div class="column is-4">${field('Camera movement', 'cameraType', shot.cameraType, { type: 'select', options: selectOptions(cameras), attrs: 'data-shot-field="cameraType"' })}</div><div class="column is-4">${field('Amplitude', 'amplitude', shot.amplitude, { type: 'select', options: selectOptions(['with small amplitude','with large amplitude']), attrs: 'data-shot-field="amplitude"' })}</div><div class="column is-4">${field('Speed', 'speed', shot.speed, { type: 'select', options: selectOptions(['at slow speed','at fast speed']), attrs: 'data-shot-field="speed"' })}</div><div class="column is-12">${field('Additional shot detail', 'detail', shot.detail, { rows: 2, attrs: 'data-shot-field="detail"', help: 'Optional: transitions, continuity, reference labels, or any special visual direction.' })}</div></div>${nestedList('Dialogue & singing', 'dialogue', shot.dialogues, shot.id)}${nestedList('Visible on-screen text', 'text', shot.texts, shot.id)}${nestedList('Diegetic sound events', 'sound', shot.sounds, shot.id)}</div></article>`;
  }
  function nestedList(title, type, items, shotId) {
    const label = type === 'dialogue' ? 'Add dialogue' : type === 'text' ? 'Add visible text' : 'Add sound event';
    return `<section class="mt-4"><div class="entry-title"><h4 class="title is-6">${title}</h4><button class="button is-small is-link is-light" type="button" data-action="add-nested" data-type="${type}" data-shot-id="${shotId}">${label}</button></div>${items.length ? `<div class="mt-3">${items.map(item => nestedCard(type, item, shotId)).join('')}</div>` : ''}</section>`;
  }
  function nestedCard(type, item, shotId) {
    let body;
    if (type === 'dialogue') body = `<div class="columns is-multiline"><div class="column is-6">${field('Speaker identity', 'identity', item.identity || '', { type: 'input', attrs: 'data-nested-field="identity" placeholder="Young woman with a quiet, breathy voice"' })}</div><div class="column is-3">${field('Speaker ID', 'speaker', item.speaker || 'S1', { type: 'input', attrs: 'data-nested-field="speaker" placeholder="S1"' })}</div><div class="column is-3">${field('Delivery', 'delivery', item.delivery || 'says', { type: 'input', attrs: 'data-nested-field="delivery" placeholder="says"' })}</div><div class="column is-4">${field('Language', 'language', item.language || 'English', { type: 'input', attrs: 'data-nested-field="language"' })}</div><div class="column is-8">${field('Exact dialogue or lyrics', 'words', item.words || '', { rows: 2, attrs: 'data-nested-field="words"' })}</div><div class="column is-12"><label class="checkbox mr-4"><input type="checkbox" data-nested-field="voiceover" ${item.voiceover ? 'checked' : ''}> Off-screen voiceover</label><label class="checkbox mr-4"><input type="checkbox" data-nested-field="acrossCut" ${item.acrossCut ? 'checked' : ''}> Continues across cut</label><label class="checkbox"><input type="checkbox" data-nested-field="cutoff" ${item.cutoff ? 'checked' : ''}> Cut off at video end</label></div></div>`;
    else if (type === 'text') body = `<div class="columns"><div class="column is-5">${field('Visible text', 'content', item.content || '', { type: 'input', attrs: 'data-nested-field="content"' })}</div><div class="column is-7">${field('Placement / appearance', 'detail', item.detail || '', { type: 'input', attrs: 'data-nested-field="detail" placeholder="A red neon sign above the doorway"' })}</div></div>`;
    else body = field('Sound event', 'content', item.content || '', { rows: 2, attrs: 'data-nested-field="content"', help: 'Sound the characters can hear; do not repeat global ambience.' });
    return `<div class="box is-shadowless has-background-light mb-3" data-nested-id="${item.id}" data-shot-id="${shotId}" data-type="${type}"><button class="delete is-pulled-right" type="button" aria-label="Remove ${type}" data-action="remove-nested" data-shot-id="${shotId}" data-type="${type}" data-id="${item.id}"></button>${body}</div>`;
  }
  function sentence(text) { const t = String(text || '').trim(); return t ? (/[.!?]$/.test(t) ? t : `${t}.`) : ''; }
  function cameraText(shot) { return [shot.cameraType, shot.amplitude, shot.speed].filter(Boolean).join(' '); }
  function dialogueText(item) { if (!item.words?.trim()) return ''; const source = `${item.identity || 'The speaker'} (${item.speaker || 'S1'}) ${item.voiceover ? 'says in an off-screen voiceover' : (item.delivery || 'says')}: <d>[${item.language || 'English'}] ${item.words.trim()}${item.cutoff ? ' <cutoff>' : ''}</d>`; return `${source}${item.voiceover ? ' while their lips remain completely closed' : ''}${item.acrossCut ? '; the audio continues seamlessly across the cut' : ''}.`; }
  function shotText(shot, index, full) {
    const prefix = index === 0 ? '[Shot 1]' : `[Shot ${index + 1}] At ${shot.cutTime?.trim() || '00:00.000'}, the camera cuts to`;
    const pieces = [shot.styleComposition, shot.action];
    const cam = cameraText(shot); if (cam) pieces.push(`The camera ${cam.toLowerCase()}`);
    if (shot.detail) pieces.push(shot.detail);
    shot.texts.forEach(item => { if (item.content) pieces.push(`${item.detail || 'Visible text'} reading "${item.content}"`); });
    shot.dialogues.forEach(item => pieces.push(dialogueText(item)));
    shot.sounds.forEach(item => { if (item.content) pieces.push(item.content); });
    const content = pieces.filter(Boolean).map(sentence).join(' ');
    return `${prefix}${content ? ` ${content}` : ''}`.trim();
  }
  function alignmentInstruction() {
    const duration = Number(state.duration || 0).toFixed(2); const last = state.shots.length || 1;
    if (state.mode === 'i2va') return 'For the target video, at 0.00 seconds into the target video, <Picture 1> (from [Shot 1]) is fully referenced.';
    if (state.mode === 'fl2va') return `How the reference pictures align with the target video — Picture 1 (from Shot 1) aligns with the 0.00-second mark of the target video; Picture 2 (from Shot ${last}) aligns with the ${duration}-second mark of the target video.`;
    if (state.mode === 'l2va') return `How the reference pictures align with the target video — <Picture 1> (from [Shot ${last}]) aligns with the ${duration}-second mark of the target video.`;
    return '';
  }
  function generateBase() {
    const instruction = alignmentInstruction();
    const body = state.shots.map((shot, index) => shotText(shot, index)).join(' ');
    return [instruction, `integrated_multimodal_description: ${body || '[Shot 1] '}`, `overall_soundscape: ${state.soundscape.trim() || 'N/A'}`, `non_diegetic_music: ${state.music.trim() || 'N/A'}`].filter((line, i) => line || i > 0).join('\n\n');
  }
  function generateFull() {
    const definitionLines = Object.entries(refConfig).flatMap(([kind, config]) => state.refs[kind].map((entry, index) => `<${config.label} ${index + 1}> is ${entry.definition?.trim() || '[describe this reference]'}`));
    const retention = Object.entries(refConfig).flatMap(([kind, config]) => state.refs[kind].map((entry, index) => `<${config.label} ${index + 1}>${entry.appears?.trim() ? ` (${entry.appears.trim()})` : ''}: ${entry.relationship || config.relations[0]}${entry.retention?.trim() ? ` - ${entry.retention.trim()}` : ''}`));
    const detail = [state.fullStyle.trim(), state.shots.map((shot, index) => shotText(shot, index, true)).join(' ')].filter(Boolean).join('\n');
    const prefix = state.taskTypes.length ? `[${state.taskTypes.join(' + ')}] ` : '';
    return [
      `subject_definitions:\n${definitionLines.join('\n') || '[Add reference definitions above.]'}`,
      `summary: ${prefix}${state.fullSummary.trim() || 'Describe the target video and its reference relationships.'}`,
      `retention_analysis:\n${retention.join('\n') || '[Add retention entries for each reference.]'}`,
      `detailed_description: ${detail || '[Shot 1] '}`,
      `overall_soundscape: ${state.soundscape.trim() || 'N/A'}`,
      `non_diegetic_music: ${state.music.trim() || 'N/A'}`
    ].join('\n\n');
  }
  function renderOutput() { reindex(); $('#output').textContent = state.mode === 'full' ? generateFull() : generateBase(); }
  function renderAll() { reindex(); renderPromptManager(); renderSettings(); renderKeyframes(); renderReferenceGroups(); renderShots(); renderOutput(); }

  document.addEventListener('input', event => {
    const target = event.target;
    if (target.matches('#prompt-name')) { activePrompt().name = target.value.trim() || 'Untitled prompt'; saveLibrary(); return; }
    if (target.matches('#mode, #duration, #soundscape, #music, #full-summary, #full-style')) { saveAndRender(); return; }
    const shotEl = target.closest('[data-shot-id]'); if (shotEl && target.dataset.shotField) { const shot = state.shots.find(s => s.id === shotEl.dataset.shotId); shot[target.dataset.shotField] = target.value; saveAndRender(); return; }
    const refEl = target.closest('[data-ref-id]'); if (refEl && target.dataset.refField) { const ref = state.refs[refEl.dataset.kind].find(r => r.id === refEl.dataset.refId); ref[target.dataset.refField] = target.value; saveAndRender(); return; }
    const nestedEl = target.closest('[data-nested-id]'); if (nestedEl && target.dataset.nestedField) { const shot = state.shots.find(s => s.id === nestedEl.dataset.shotId); const key = `${nestedEl.dataset.type}s`; const item = shot[key].find(i => i.id === nestedEl.dataset.nestedId); item[target.dataset.nestedField] = target.type === 'checkbox' ? target.checked : target.value; saveAndRender(); return; }
    const keyframeEl = target.closest('#keyframes'); if (keyframeEl && target.dataset.key === 'description') { state.keyframes[$$('#keyframes article').indexOf(target.closest('article'))].description = target.value; saveAndRender(); }
  });
  document.addEventListener('change', event => {
    if (event.target.matches('#mode')) { renderAll(); saveAndRender(); }
    if (event.target.matches('#prompt-library')) {
      syncFormState(); saveLibrary();
      library.activePromptId = event.target.value;
      state = activePrompt().state;
      renderAll();
      return;
    }
    if (event.target.matches('#prompt-name')) {
      const prompt = activePrompt();
      prompt.name = event.target.value.trim() || 'Untitled prompt';
      saveLibrary();
      renderPromptManager();
      return;
    }
    if (event.target.dataset.taskType) { state.taskTypes = $$('[data-task-type]:checked').map(el => el.dataset.taskType); saveAndRender(); }
  });
  document.addEventListener('click', event => {
    const button = event.target.closest('[data-action]'); if (!button) return; const { action, id, kind, type, shotId, direction } = button.dataset;
    if (action === 'add-shot') state.shots.push({ id: uid(), cutTime: '', styleComposition: '', action: '', cameraType: '', amplitude: '', speed: '', detail: '', dialogues: [], texts: [], sounds: [] });
    if (action === 'remove-shot') state.shots = state.shots.filter(s => s.id !== id);
    if (action === 'move-shot') { const index = state.shots.findIndex(s => s.id === id); const next = index + Number(direction); if (next >= 0 && next < state.shots.length) [state.shots[index], state.shots[next]] = [state.shots[next], state.shots[index]]; }
    if (action === 'add-ref') state.refs[kind].push({ id: uid(), definition: '', appears: '', relationship: refConfig[kind].relations[0], retention: '' });
    if (action === 'remove-ref') state.refs[kind] = state.refs[kind].filter(r => r.id !== id);
    if (action === 'add-nested') { const shot = state.shots.find(s => s.id === shotId); const key = `${type}s`; shot[key].push({ id: uid() }); }
    if (action === 'remove-nested') { const shot = state.shots.find(s => s.id === shotId); const key = `${type}s`; shot[key] = shot[key].filter(item => item.id !== id); }
    renderAll(); saveAndRender();
  });
  $('#copy').addEventListener('click', async () => {
    const output = $('#output'); const copyButton = $('#copy');
    const showCopied = () => {
      copyButton.classList.remove('is-primary'); copyButton.classList.add('is-success');
      copyButton.textContent = 'Copied!'; copyButton.disabled = true;
      $('#copy-status').textContent = 'Prompt copied to your clipboard.';
      window.setTimeout(() => {
        copyButton.classList.remove('is-success'); copyButton.classList.add('is-primary');
        copyButton.textContent = 'Copy prompt'; copyButton.disabled = false;
      }, 1600);
    };
    try {
      await navigator.clipboard.writeText(output.textContent);
      showCopied();
    } catch {
      const selection = window.getSelection();
      const range = document.createRange();
      range.selectNodeContents(output); selection.removeAllRanges(); selection.addRange(range);
      document.execCommand('copy'); selection.removeAllRanges();
      showCopied();
    }
  });
  $('#new-prompt').addEventListener('click', () => {
    syncFormState(); saveLibrary();
    const prompt = makePrompt('Untitled prompt');
    library.prompts.push(prompt); library.activePromptId = prompt.id; state = prompt.state;
    saveLibrary(); renderAll(); $('#prompt-name').focus(); $('#prompt-name').select();
  });
  $('#duplicate-prompt').addEventListener('click', () => {
    syncFormState(); saveLibrary();
    const source = activePrompt(); const prompt = makePrompt(`${source.name} copy`, clone(state));
    library.prompts.push(prompt); library.activePromptId = prompt.id; state = prompt.state;
    saveLibrary(); renderAll(); $('#prompt-name').focus(); $('#prompt-name').select();
  });
  $('#export-prompt').addEventListener('click', () => {
    syncFormState(); saveLibrary();
    const prompt = activePrompt();
    const payload = {
      format: 'minimax-h3-prompt',
      version: 1,
      exportedAt: new Date().toISOString(),
      prompt: { name: prompt.name, state: clone(state) }
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob); const link = document.createElement('a');
    link.href = url; link.download = `${safeFilename(prompt.name)}.json`;
    document.body.append(link); link.click(); link.remove(); window.setTimeout(() => URL.revokeObjectURL(url), 0);
    setLibraryStatus(`Exported “${prompt.name}” as a JSON file.`);
  });
  $('#import-prompt').addEventListener('click', () => $('#prompt-import-file').click());
  $('#prompt-import-file').addEventListener('change', async event => {
    const [file] = event.target.files;
    event.target.value = '';
    if (!file) return;
    try {
      const payload = JSON.parse(await file.text());
      if (payload?.format !== 'minimax-h3-prompt' || payload.version !== 1 || !payload.prompt || typeof payload.prompt.state !== 'object') throw new Error('Invalid format');
      syncFormState(); saveLibrary();
      const prompt = makePrompt(payload.prompt.name || 'Imported prompt', payload.prompt.state);
      library.prompts.push(prompt); library.activePromptId = prompt.id; state = prompt.state;
      saveLibrary(); renderAll();
      setLibraryStatus(`Imported and loaded “${prompt.name}”.`);
    } catch {
      setLibraryStatus('Import failed. Choose a prompt JSON file exported by this app.');
    }
  });
  $('#delete-prompt').addEventListener('click', () => {
    if (library.prompts.length === 1 || !confirm(`Delete “${activePrompt().name}”? This cannot be undone.`)) return;
    library.prompts = library.prompts.filter(prompt => prompt.id !== library.activePromptId);
    library.activePromptId = library.prompts[0].id; state = activePrompt().state;
    saveLibrary(); renderAll();
  });
  $('#reset').addEventListener('click', () => { if (!confirm('Clear the current prompt? This cannot be undone.')) return; state = defaultState(); saveLibrary(); renderAll(); });
  renderAll();
})();
