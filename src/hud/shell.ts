/**
 * The HUD markup. Painted by boot.ts before MapLibre downloads, so the driver
 * sees the HUD (and the login gate) on a slow phone while the map engine loads;
 * main.ts wires the listeners once it arrives.
 */
export const HUD_HTML = `
  <div id="map"></div>
  <div class="vignette"></div>
  <div class="hud">
    <button class="map-fab menu-fab plan-only" id="menu-fab" type="button" aria-label="Menu">☰</button>
    <button class="map-fab compass-fab plan-only" id="compass-fab" type="button" aria-label="North up">
      <svg viewBox="0 0 24 24" width="22" height="22" aria-hidden="true"><path d="M12 3l4 14-4-2-4 2z" fill="currentColor"/></svg>
    </button>
    <button class="map-fab locate-fab plan-only" id="locate-fab" type="button" aria-label="Locate">⌖</button>
    <div class="panel search-card plan-only" id="search-card">
      <div class="brand desktop-only"><h1>Slide</h1><span class="chip" id="rank-chip">GARAGE</span><button class="icon" id="help" type="button" aria-label="How to Slide">?</button></div>
      <div class="where-row">
        <svg class="where-icon" viewBox="0 0 24 24" aria-hidden="true"><circle cx="11" cy="11" r="6.5" fill="none" stroke="currentColor" stroke-width="2"/><path d="M16 16l5 5" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round"/></svg>
        <input id="to" placeholder="Where to?" autocomplete="off" />
        <div class="suggest" id="to-suggest" hidden></div>
      </div>
      <div class="sheet-more">
        <div class="fields">
          <div class="field"><label>From</label><input id="from" value="Current location" placeholder="Current location or address" autocomplete="off" /><button type="button" class="use-gps" id="from-gps" aria-label="Start from my current location"><svg viewBox="0 0 24 24" width="12" height="12" aria-hidden="true"><path d="M21 3L3 10.5l7.5 2.9L13.4 21z" fill="currentColor"/></svg>Me</button><div class="suggest" id="from-suggest" hidden></div></div>
        </div>
        <div class="place-chips" id="place-chips">
          <button type="button" class="place-chip" id="chip-home">Home</button>
          <button type="button" class="place-chip" id="chip-work">Work</button>
          <button type="button" class="place-chip" id="chip-saved" hidden></button>
        </div>
        <div class="recents" id="recents" hidden></div>
        <div class="actions">
          <button class="primary" id="go">Drop the line</button>
          <button class="ghost" id="locate">Locate</button>
          <button class="icon" id="tune">Tune</button>
        </div>
        <div class="error" id="error" hidden></div>
      </div>
    </div>
    <div class="panel status-pill" id="status">Locking a 3D line…</div>
    <div class="panel loc-banner fail-sheet" id="loc-banner" role="alert" hidden>
      <b class="net-title" id="loc-title"></b>
      <p id="loc-msg"></p>
      <div class="loc-actions">
        <button class="ghost" id="loc-search" type="button">Search a start point instead</button>
        <button class="primary" id="loc-retry" type="button">Try again</button>
        <button class="icon loc-close" id="loc-close" type="button" aria-label="Dismiss">×</button>
      </div>
    </div>
    <div class="panel loc-banner net-sheet fail-sheet" id="net-sheet" role="alert" hidden>
      <b class="net-title" id="net-title"></b>
      <p id="net-msg"></p>
      <div class="loc-actions">
        <button class="primary" id="net-retry" type="button">Try again</button>
        <button class="icon loc-close" id="net-close" type="button" aria-label="Dismiss">×</button>
      </div>
    </div>
    <div class="panel place-card plan-only" id="place-card" hidden>
      <button class="icon loc-close" id="place-close" type="button" aria-label="Close place">×</button>
      <h2 id="place-name"></h2>
      <p id="place-addr"></p>
      <p class="place-saved" id="place-saved" hidden>Saved on this phone.</p>
      <div class="place-actions">
        <button class="ghost" id="place-save" type="button">Save</button>
        <button class="primary" id="place-go" type="button">Go</button>
      </div>
    </div>
    <div class="panel maneuver drive-only" id="maneuver" hidden>
      <svg class="arrow" viewBox="0 0 24 24" aria-hidden="true"><path id="man-arrow" d="" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg>
      <div class="man-text"><b id="man-dist" class="is-empty">Next turn</b><span id="man-instr">Follow the line</span></div>
      <div class="man-bar"><i id="man-fill"></i></div>
    </div>
    <div id="lane-strip" class="lane-strip drive-only" data-slot="lane-strip" hidden aria-label="Lane guidance"></div>
    <div class="panel posted-chip drive-only" id="posted" hidden></div>
    <div class="panel review-sheet review-only" id="review-sheet" hidden>
      <div class="route-carousel" id="route-carousel" aria-label="Route choices">
        <div class="route-track" id="route-track"></div>
        <div class="route-dots" id="route-dots" hidden></div>
      </div>
      <div class="review-head sr" aria-live="polite">
        <b id="review-eta" class="is-empty">After a plan</b>
        <span id="review-dist">After a plan</span>
      </div>
      <p class="review-via sr" id="review-via"></p>
      <p class="review-tag sr" id="review-tag"></p>
      <p class="review-eta-note" id="review-eta-note">Typical time · no live traffic yet</p>
      <ol class="stops-list" id="stops-list" aria-label="Stops, in driving order"></ol>
      <div class="stop-search" id="stop-search" hidden>
        <input id="stop-input" placeholder="Add a stop" autocomplete="off" aria-label="Search for a stop" />
        <div class="suggest" id="stop-suggest" hidden></div>
      </div>
      <div class="review-tools">
        <button class="tool" id="review-add-stop" type="button">+ Add stop</button>
        <button class="tool icon" id="review-options" type="button" aria-label="Route options" aria-haspopup="dialog">
          <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" aria-hidden="true"><path d="M4 7h10M18 7h2M4 17h4M12 17h8"/><circle cx="16" cy="7" r="2"/><circle cx="10" cy="17" r="2"/></svg>
        </button>
      </div>
      <div class="review-actions">
        <button class="ghost" id="review-back" type="button">Where to?</button>
        <button class="primary" id="review-go" type="button">Go now</button>
      </div>
    </div>
    <div class="panel options-sheet" id="route-options" role="dialog" aria-modal="true" aria-labelledby="ro-title" hidden>
      <h2 id="ro-title">Route options</h2>
      <label class="switch"><span>Avoid tolls<small>SunPass and toll roads</small></span><input type="checkbox" id="ro-tolls" /></label>
      <label class="switch"><span>Avoid highways</span><input type="checkbox" id="ro-highways" /></label>
      <label class="switch"><span>Avoid ferries</span><input type="checkbox" id="ro-ferries" /></label>
      <button class="primary" id="ro-done" type="button">Done</button>
    </div>
    <div class="panel arrival-sheet trip-card arrive-only" id="arrival" role="dialog" aria-labelledby="arr-dest" hidden>
      <span class="arr-kicker" id="arr-kicker">ARRIVED</span>
      <div class="arr-ride" id="arr-ride" aria-hidden="true"></div>
      <h2 id="arr-dest">Your destination</h2>
      <div class="arr-stats">
        <div><span>Drive time</span><b id="arr-time" class="is-empty">After a trip</b></div>
        <div><span>Driven</span><b id="arr-dist" class="is-empty">After a trip</b></div>
        <div><span>Line</span><b id="arr-line" class="is-empty">After a trip</b></div>
      </div>
      <div id="arr-xp" class="arr-xp" data-slot="arrival-xp" hidden aria-label="Trip XP and badges"></div>
      <p class="arr-note" id="arr-note"></p>
      <div id="share-card-mount" class="share-card-mount" data-slot="share-card" hidden aria-label="Shareable trip card"></div>
      <div class="arr-actions">
        <button class="ghost" id="arr-share" type="button">Share</button>
        <button class="primary" id="arr-done" type="button">Done</button>
      </div>
    </div>
    <div class="panel dash plan-only" id="dash" hidden>
      <div class="stat-row">
        <div class="stat"><span>Slide</span><b id="stat-score" class="is-empty">After a plan</b></div>
        <div class="stat"><span>Arrive</span><b id="stat-eta" class="is-empty">After a plan</b></div>
        <div class="stat"><span>Ghosts</span><b id="stat-ghosts">0</b></div>
        <div class="stat"><span>Streak</span><b id="stat-streak">0</b></div>
      </div>
      <div id="routes"></div>
    </div>
    <div class="speedo drive-only" id="speedo" hidden>
      <div class="cluster">
        <div class="limit unsigned" id="limit" aria-label="No posted limit"><span>Speed limit</span><b id="limit-n">--</b></div>
        <div class="live"><div class="n" id="speed-n">0</div><div class="u" id="speed-src">MPH</div></div>
      </div>
      <div class="ghost-delta" id="ghost-delta" hidden>GHOST ±0.0s</div>
    </div>
    <button class="panel recenter drive-only" id="recenter" hidden>Recenter</button>
    <div class="panel speed-rail" id="speeds" hidden></div>
    <div class="panel drive-bar drive-only" id="drive-bar" hidden>
      <div class="meta"><b id="drive-eta" class="is-empty">After a plan</b><span id="drive-remain">Remaining once GPS locks</span><small id="drive-traffic" hidden></small></div>
      <div class="drive-controls">
        <button type="button" id="drive-mute" class="drive-mute" data-slot="drive-mute" aria-label="Mute voice guidance" aria-pressed="false" hidden></button>
        <button class="icon" id="more" type="button" aria-label="More">⋯</button>
        <button class="end" id="end-drive" type="button">End</button>
      </div>
    </div>
    <button class="drive-report drive-only" id="drive-report" type="button" hidden aria-label="Report something on the road">
      <span class="drive-report-ico" aria-hidden="true"><svg viewBox="0 0 24 24" width="22" height="22"><path d="M6 4v16M6 5h11l-2 3 2 3H6" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/></svg></span>
      Report
    </button>
    <div class="panel overflow" id="overflow">
      <button type="button" id="ov-profile">Profile</button>
      <button type="button" id="ov-tune">Tune garage</button>
      <button type="button" id="ov-help">How to Slide</button>
      <button type="button" id="ov-rail">Speed rail</button>
      <button type="button" id="ov-home">Save destination as Home</button>
      <button type="button" id="ov-work">Save destination as Work</button>
      <button type="button" id="ov-insights">Drive insights</button>
      <button type="button" id="ov-lock">Lock Slide</button>
    </div>
    <div class="coach" id="coach" hidden>
      <div class="panel coach-card">
        <h2>How to Slide</h2>
        <ol>
          <li>Type <b>Where to?</b><span>Or tap Home / Work. Locate sets From.</span></li>
          <li>Slide drops the smoothest line<span>Tap <b>Go now</b>. Fastest is an explicit pick on the map.</span></li>
          <li>Follow the banner<span>Posted limit is the sign. Never a target to beat.</span></li>
        </ol>
        <button class="primary" id="coach-ok" type="button">Got it</button>
      </div>
    </div>
    <div class="panel garage" id="garage">
      <div class="garage-head"><h3>Garage</h3><button class="close" id="g-close" aria-label="Close garage">×</button></div>
      <div class="showroom" aria-live="polite">
        <div class="showroom-stage" id="g-preview"></div>
        <div class="showroom-meta"><b id="g-ride-name"></b><span id="g-ride-kind"></span><small id="g-ride-pack"></small></div>
      </div>
      <label>Ride</label><div class="rides" id="g-rides" role="radiogroup" aria-label="Choose your ride"></div>
      <label>Livery</label><div class="liveries" id="g-livery" role="radiogroup" aria-label="Livery"></div>
      <label>Theme</label><select id="g-look"><option value="night">Night</option><option value="ember">Ember</option><option value="sand">Sand</option></select>
      <label>Tag</label><input id="g-tag" type="text" maxlength="12" />
      <label>Paint</label><div class="swatches" id="g-body"></div>
      <label>Accent glow</label><div class="swatches" id="g-glow"></div>
      <label>Trail</label><select id="g-trail"><option value="plasma">Plasma</option><option value="ember">Ember</option><option value="ice">Ice</option><option value="volt">Volt</option></select>
      <label>Camera</label><select id="g-cam"><option value="cinematic">Cinematic 3D</option><option value="chase">Chase</option><option value="top">Top-down</option></select>
      <div class="toggle"><span>3D buildings</span><input id="g-build" type="checkbox" /></div>
      <div class="toggle"><span>Live traffic</span><input id="g-traffic" type="checkbox" /></div>
      <div class="toggle"><span>Show ghosts</span><input id="g-ghosts" type="checkbox" /></div>
      <div class="toggle"><span>Share my ghost</span><input id="g-share" type="checkbox" /></div>
      <div class="toggle"><span>Weekly board<small>Opt in to this week's smooth average. Off by default.</small></span><input id="g-board" type="checkbox" /></div>
    </div>
    <div id="car-stage" class="car-stage" data-slot="car-stage" hidden aria-label="3D car stage"></div>
  </div>
`;
