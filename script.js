// script.js

document.addEventListener("DOMContentLoaded", () => {
  const dataUrl = "data/artworks.json";
  const seriesContainer = document.getElementById("series-container");
  const filterNav = document.getElementById("filter-nav");
  const themeToggle = document.getElementById("theme-toggle");
  const lightbox = document.getElementById("lightbox");
  const lbImage = lightbox.querySelector(".lb-image");
  const lbTitle = lightbox.querySelector(".lb-title");
  const lbMeta = lightbox.querySelector(".lb-meta");
  const lbDesc = lightbox.querySelector(".lb-description");
  const lbClose = lightbox.querySelector(".lb-close");
  const lbPrev = lightbox.querySelector(".lb-prev");
  const lbNext = lightbox.querySelector(".lb-next");

  let artworks = [];
  let seriesMap = new Map(); // series_slug → { seriesName, items: [...] }
  let subcategorySet = new Set();
  let currentFilters = [];

  fetch(dataUrl)
    .then((res) => res.json())
    .then((list) => {
      artworks = list;
      buildSeriesMap();
      renderFilterNav();
      renderSeriesSections();
      applyHashAnchorExpand();
    });

  // = Build internal structures =
  function buildSeriesMap() {
    artworks.forEach((art) => {
      // ensure slug-safe series id
      const slug = slugify(art.series);
      if (!seriesMap.has(slug)) {
        seriesMap.set(slug, {
          seriesName: art.series,
          slug,
          items: [],
        });
      }
      seriesMap.get(slug).items.push(art);

      art.subcategories.split(",").map(s => s.trim()).forEach(s => {
        if (s) subcategorySet.add(s);
      });
    });
    // sort each series' items by sub_order
    for (const [, rec] of seriesMap) {
      rec.items.sort((a, b) => a.sub_order - b.sub_order);
    }
  }

  // = UI Rendering =
  function renderFilterNav() {
    const subcats = Array.from(subcategorySet).sort();
    subcats.forEach((subcat) => {
      const btn = document.createElement("button");
      btn.textContent = subcat;
      btn.classList.add("filter-pill");
      btn.type = "button";
      btn.addEventListener("click", () => {
        toggleFilter(subcat);
      });
      filterNav.appendChild(btn);
    });
  }

  function renderSeriesSections() {
    for (const [slug, rec] of seriesMap) {
      const section = document.createElement("section");
      section.classList.add("series");
      section.id = `series-${slug}`;
      section.setAttribute("data-slug", slug);

      // header
      const header = document.createElement("div");
      header.classList.add("series-header");
      header.tabIndex = 0;
      header.setAttribute("role", "button");
      header.setAttribute("aria-expanded", "false");

      const thumb = document.createElement("img");
      thumb.classList.add("series-thumb");
      // find first item thumb
      const firstItem = rec.items[0];
      thumb.src = firstItem.thumb_file;
      thumb.alt = firstItem.alt_text || rec.seriesName;
      thumb.loading = "lazy";

      const info = document.createElement("div");
      info.classList.add("series-info");
      const h2 = document.createElement("h2");
      h2.textContent = rec.seriesName;
      const subcatsText = rec.items
        .flatMap(i => i.subcategories.split(",").map(s => s.trim()))
        .filter((v, i, a) => v && a.indexOf(v) === i)
        .join(", ");
      const sc = document.createElement("div");
      sc.classList.add("series-subcats");
      sc.textContent = subcatsText;

      info.append(h2, sc);

      const toggleIcon = document.createElement("span");
      toggleIcon.classList.add("series-toggle-icon", "collapsed");
      toggleIcon.innerHTML = "▶";

      header.append(thumb, info, toggleIcon);

      // gallery
      const gallery = document.createElement("div");
      gallery.classList.add("series-gallery");

      rec.items.forEach((item, idx) => {
        const gi = document.createElement("div");
        gi.classList.add("gallery-item");
        gi.dataset.series = slug;
        gi.dataset.index = idx;

        const img = document.createElement("img");
        img.src = item.thumb_file;
        img.alt = item.alt_text || item.title;
        img.loading = "lazy";

        const overlay = document.createElement("div");
        overlay.classList.add("item-overlay");
        overlay.textContent = `${item.year} — ${item.title}`;

        gi.append(img, overlay);
        gi.addEventListener("click", () => openLightbox(slug, idx));
        gallery.appendChild(gi);
      });

      // event handler to expand/collapse
      header.addEventListener("click", () => toggleSeries(section));
      header.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          toggleSeries(section);
        }
      });

      section.append(header, gallery);
      seriesContainer.appendChild(section);
    }
  }

  // = Filtering logic =
  function toggleFilter(subcat) {
    const idx = currentFilters.indexOf(subcat);
    if (idx >= 0) {
      currentFilters.splice(idx, 1);
    } else {
      currentFilters.push(subcat);
    }
    updateFilterPillStates();
    filterSeries();
  }

  function updateFilterPillStates() {
    Array.from(filterNav.children).forEach(btn => {
      if (currentFilters.includes(btn.textContent)) {
        btn.classList.add("active");
      } else {
        btn.classList.remove("active");
      }
    });
  }

  function filterSeries() {
    for (const section of seriesContainer.querySelectorAll(".series")) {
      const slug = section.dataset.slug;
      const rec = seriesMap.get(slug);
      const gallery = section.querySelector(".series-gallery");
      let anyVisible = false;

      rec.items.forEach((item, idx) => {
        const gi = gallery.children[idx];
        const itemSubs = item.subcategories.split(",").map(s => s.trim());
        const matches = currentFilters.every(f => itemSubs.includes(f));
        gi.style.display = matches ? "" : "none";
        if (matches) anyVisible = true;
      });

      // hide entire series if no items match
      section.style.display = anyVisible ? "" : "none";
    }
  }

  // = Expand / collapse =
  function toggleSeries(section, toExpand = null) {
    const header = section.querySelector(".series-header");
    const gallery = section.querySelector(".series-gallery");
    const icon = header.querySelector(".series-toggle-icon");
    const isExpanded = gallery.classList.contains("expanded");
    let expand = toExpand === null ? !isExpanded : toExpand;

    if (expand) {
      gallery.classList.add("expanded");
      header.setAttribute("aria-expanded", "true");
      icon.classList.remove("collapsed");
      icon.innerHTML = "▼";
      // optionally scroll into view
      section.scrollIntoView({ behavior: "smooth", block: "start" });
    } else {
      gallery.classList.remove("expanded");
      header.setAttribute("aria-expanded", "false");
      icon.classList.add("collapsed");
      icon.innerHTML = "▶";
    }
  }

  function applyHashAnchorExpand() {
    const hash = window.location.hash;
    if (hash.startsWith("#series-")) {
      const target = document.querySelector(hash);
      if (target) {
        toggleSeries(target, true);
      }
    }
  }

  // = Lightbox logic =
  let currentSeries = null;
  let currentIndex = null;

  function openLightbox(seriesSlug, idx) {
    currentSeries = seriesMap.get(seriesSlug);
    currentIndex = idx;
    showLightbox();
  }

  function showLightbox() {
    const item = currentSeries.items[currentIndex];
    lbImage.src = item.image_file;
    lbImage.alt = item.alt_text || item.title;
    lbTitle.textContent = item.title;
    lbMeta.textContent = `${item.year} — ${item.medium}, ${item.dimensions}`;
    lbDesc.textContent = item.image_description || "";

    lightbox.classList.remove("hidden");
  }

  function closeLightbox() {
    lightbox.classList.add("hidden");
  }

  function showPrev() {
    currentIndex = (currentIndex - 1 + currentSeries.items.length) % currentSeries.items.length;
    showLightbox();
  }

  function showNext() {
    currentIndex = (currentIndex + 1) % currentSeries.items.length;
    showLightbox();
  }

  lbClose.addEventListener("click", closeLightbox);
  lbPrev.addEventListener("click", showPrev);
  lbNext.addEventListener("click", showNext);

  lightbox.addEventListener("click", (e) => {
    if (e.target === lightbox) {
      closeLightbox();
    }
  });
  document.addEventListener("keydown", (e) => {
    if (lightbox.classList.contains("hidden")) return;
    if (e.key === "Escape") closeLightbox();
    if (e.key === "ArrowLeft") showPrev();
    if (e.key === "ArrowRight") showNext();
  });

  // = Dark / Light toggle =
  function setTheme(isDark) {
    if (isDark) {
      document.body.classList.add("dark");
      themeToggle.textContent = "☀️";
    } else {
      document.body.classList.remove("dark");
      themeToggle.textContent = "🌙";
    }
    localStorage.setItem("themeDark", isDark ? "1" : "0");
  }
  themeToggle.addEventListener("click", () => {
    const isDark = document.body.classList.toggle("dark");
    setTheme(isDark);
  });
  (function loadThemeFromStorage() {
    const dark = localStorage.getItem("themeDark") === "1";
    setTheme(dark);
  })();

  // = Utility functions =
  function slugify(str) {
    return str
      .toString()
      .toLowerCase()
      .trim()
      .replace(/\s+/g, "-")
      .replace(/[^\w\-]+/g, "")
      .replace(/\-\-+/g, "-");
  }
});
