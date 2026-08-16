(function () {
  if (document.getElementById("site-footer")) return;

  const LOGO =
    "data:image/jpeg;base64,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JgAAADsBAgAIAAAALQAAAAAAAABHb29nbGUARCBhbmQgRwAAWE1QIMwBAAA8P3hwYWNrZXQgYmVnaW49Iu+7vyIgaWQ9Ilc1TTBNcENlaGlIenJlU3pOVGN6a2M5ZCI/PiA8eDp4bXBtZXRhIHhtbG5zOng9ImFkb2JlOm5zOm1ldGEvIiB4OnhtcHRrPSJYTVAgQ29yZSA1LjUuMCI+IDxyZGY6UkRGIHhtbG5zOnJkZj0iaHR0cDovL3d3dy53My5vcmcvMTk5OS8wMi8yMi1yZGYtc3ludGF4LW5zIyI+IDxyZGY6RGVzY3JpcHRpb24gcmRmOmFib3V0PSIiIHhtbG5zOnhtcD0iaHR0cDovL25zLmFkb2JlLmNvbS94YXAvMS4wLyIgeG1sbnM6ZGM9Imh0dHA6Ly9wdXJsLm9yZy9kYy9lbGVtZW50cy8xLjEvIiB4bXA6Q3JlYXRvclRvb2w9Ikdvb2dsZSI+IDxkYzpjcmVhdG9yPiA8cmRmOlNlcT4gPHJkZjpsaT5EIGFuZCBHPC9yZGY6bGk+IDwvcmRmOlNlcT4gPC9kYzpjcmVhdG9yPiA8L3JkZjpEZXNjcmlwdGlvbj4gPC9yZGY6UkRGPiA8L3g6eG1wbWV0YT4gICA8P3hwYWNrZXQgZW5kPSJ3Ij8+";

  const footer = document.createElement("footer");
  footer.className = "site-footer";
  footer.id = "site-footer";
  footer.innerHTML = `
    <div class="foot">
      <a class="brand" href="/">
        <img class="mark" alt="Devtechinvento logo" src="${LOGO}">
        <span>Devtechinvento<small>© 2026 Gayan N. Wimalarathna</small></span>
      </a>
      <div class="foot-links">
        <a href="https://www.devtechinvento.com/resume" target="_blank" rel="noopener">Résumé</a>
        <a href="https://www.devtechinvento.com/privacy-policy" target="_blank" rel="noopener">Privacy Policy</a>
        <a href="https://www.devtechinvento.com" target="_blank" rel="noopener">www.devtechinvento.com</a>
        <a href="#" class="termly-display-preferences">Consent Preferences</a>
      </div>
      <div class="socials">
        <a href="https://www.linkedin.com/in/gayanwimalarathna/" target="_blank" rel="noopener" title="LinkedIn" aria-label="LinkedIn">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 448 512" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M416 32H31.9C14.3 32 0 46.5 0 64.3v383.4C0 465.5 14.3 480 31.9 480H416c17.6 0 32-14.5 32-32.3V64.3c0-17.8-14.4-32.3-32-32.3zM135.4 416H69V202.2h66.5V416zm-33.2-243c-21.3 0-38.5-17.3-38.5-38.5S80.9 96 102.2 96c21.2 0 38.5 17.3 38.5 38.5 0 21.3-17.2 38.5-38.5 38.5zm282.1 243h-66.4V312c0-24.8-.5-56.7-34.5-56.7-34.6 0-39.9 27-39.9 54.9V416h-66.4V202.2h63.7v29.2h.9c8.9-16.8 30.6-34.5 62.9-34.5 67.2 0 79.7 44.3 79.7 101.9V416z"></path></svg>
        </a>
        <a href="https://github.com/gayanishakaraw" target="_blank" rel="noopener" title="GitHub" aria-label="GitHub">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 496 512" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M165.9 397.4c0 2-2.3 3.6-5.2 3.6-3.3.3-5.6-1.3-5.6-3.6 0-2 2.3-3.6 5.2-3.6 3-.3 5.6 1.3 5.6 3.6zm-31.1-4.5c-.7 2 1.3 4.3 4.3 4.9 2.6 1 5.6 0 6.2-2s-1.3-4.3-4.3-5.2c-2.6-.7-5.5.3-6.2 2.3zm44.2-1.7c-2.9.7-4.9 2.6-4.6 4.9.3 2 2.9 3.3 5.9 2.6 2.9-.7 4.9-2.6 4.6-4.6-.3-1.9-3-3.2-5.9-2.9zM244.8 8C106.1 8 0 113.3 0 252c0 110.9 69.8 205.8 169.5 239.2 12.8 2.3 17.3-5.6 17.3-12.1 0-6.2-.3-40.4-.3-61.4 0 0-70 15-84.7-29.8 0 0-11.4-29.1-27.8-36.6 0 0-22.9-15.7 1.6-15.4 0 0 24.9 2 38.6 25.8 21.9 38.6 58.6 27.5 72.9 20.9 2.3-16 8.8-27.1 16-33.7-55.9-6.2-112.3-14.3-112.3-110.5 0-27.5 7.6-41.3 23.6-58.9-2.6-6.5-11.1-33.3 2.6-67.9 20.9-6.5 69 27 69 27 20-5.6 41.5-8.5 62.8-8.5s42.8 2.9 62.8 8.5c0 0 48.1-33.6 69-27 13.7 34.7 5.2 61.4 2.6 67.9 16 17.7 25.8 31.5 25.8 58.9 0 96.5-58.9 104.2-114.8 110.5 9.2 7.9 17 22.9 17 46.4 0 33.7-.3 75.4-.3 83.6 0 6.5 4.6 14.4 17.3 12.1C428.2 457.8 496 362.9 496 252 496 113.3 383.5 8 244.8 8z"></path></svg>
        </a>
        <a href="https://www.facebook.com/people/Dev-Tech-Invento/100089934815888/" target="_blank" rel="noopener" title="Facebook" aria-label="Facebook">
          <svg stroke="currentColor" fill="currentColor" stroke-width="0" viewBox="0 0 512 512" height="18" width="18" xmlns="http://www.w3.org/2000/svg"><path d="M504 256C504 119 393 8 256 8S8 119 8 256c0 123.78 90.69 226.38 209.25 245V327.69h-63V256h63v-54.64c0-62.15 37-96.48 93.67-96.48 27.14 0 55.52 4.84 55.52 4.84v61h-31.28c-30.8 0-40.41 19.12-40.41 38.73V256h68.78l-11 71.69h-57.78V501C413.31 482.38 504 379.78 504 256z"></path></svg>
        </a>
      </div>
    </div>
    <div class="copy">© 2026 Devtechinvento · Gayan N. Wimalarathna</div>`;

  document.body.appendChild(footer);

  // The quiz page has a fixed bottom action bar; give the footer clearance so
  // it isn't hidden behind it.
  if (document.querySelector(".button-group")) {
    footer.style.marginBottom = "84px";
  }
})();
