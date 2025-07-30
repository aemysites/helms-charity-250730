import {
  loadHeader,
  loadFooter,
  decorateButtons,
  decorateIcons,
  decorateLinkedPictures,
  decorateSections,
  decorateBlocks,
  decorateTemplateAndTheme,
  waitForFirstImage,
  loadSection,
  loadSections,
  loadCSS,
} from './aem.js';

// Consultas de mídia (media queries/viewports). ref:  https://www.freecodecamp.org/news/the-100-correct-way-to-do-css-breakpoints-88d6a5ba1862/
const MOBILE_MQ = window.matchMedia('(max-width:599px)');
const TABLET_MQ = window.matchMedia('(min-width:600px)');
const DESKTOP_MQ = window.matchMedia('(min-width:900px)');
// adicione os modelos permitidos aqui (add the allowed templates here)
// const TEMPLATES = ['property', 'home'];

/**
 * Moves all the attributes from a given elmenet to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveAttributes(from, to, attributes) {
  if (!attributes) {
    // eslint-disable-next-line no-param-reassign
    attributes = [...from.attributes].map(({ nodeName }) => nodeName);
  }
  attributes.forEach((attr) => {
    const value = from.getAttribute(attr);
    if (value) {
      to.setAttribute(attr, value);
      from.removeAttribute(attr);
    }
  });
}

/**
 * Move instrumentation attributes from a given element to another given element.
 * @param {Element} from the element to copy attributes from
 * @param {Element} to the element to copy attributes to
 */
export function moveInstrumentation(from, to) {
  moveAttributes(
    from,
    to,
    [...from.attributes]
      .map(({ nodeName }) => nodeName)
      .filter((attr) => attr.startsWith('data-aue-') || attr.startsWith('data-richtext-')),
  );
}

/**
 * load fonts.css and set a session storage flag
 */
async function loadFonts() {
  await loadCSS(`${window.hlx.codeBasePath}/styles/fonts.css`);
  try {
    if (!window.location.hostname.includes('localhost')) sessionStorage.setItem('fonts-loaded', 'true');
  } catch (e) {
    // do nothing
  }
}

/**
 * Builds all synthetic blocks in a container element.
 * @param {Element} main The container element
 */
function buildAutoBlocks() {
  try {
    // TODO: add auto block, if needed
  } catch (error) {
    // eslint-disable-next-line no-console
    console.error('Auto Blocking failed', error);
  }
}

/**
 * Calcula qual índice de imagem deve ser exibido,
 * com base no número de imagens e no tamanho atual da janela de visualização.
 * Calculates which image index should be shown and when
 * @param {number} imageCount o número de imagens (3, 2 ou 1)
 * @returns {number} o índice da imagem a ser exibida.
 */
function getResponsiveImageIndex(imageCount) {
  if (imageCount === 3) {
    if (MOBILE_MQ.matches) return 0;
    if (TABLET_MQ.matches && !DESKTOP_MQ.matches) return 1;
    if (DESKTOP_MQ.matches) return 2;
    return 0; // fallback (contingência)
  }
  if (imageCount === 2) {
    if (MOBILE_MQ.matches) return 0;
    if (TABLET_MQ.matches || DESKTOP_MQ.matches) return 1;
    return 0; // fallback (contingência)
  }
  return 0; // fallback (contingência)
}

/**
 * Cria um array de imagens a partir de um array de elementos picture.
 * Creates an array of images from a given array of picture elements.
 * @param {Array} pictures o array de elementos picture
 * @returns {Array} o array de imagens
 */
function getResponsiveImageEntries(pictures) {
  return Array.from(pictures).map((picture, idx) => (
    {
      idx,
      picture,
      parent: picture.parentElement,
      img: picture.querySelector('img'),
    }
  ));
}

/**
 * Atualiza as imagens responsivas e seus atributos de carregamento
 * Updates the responsive images and their loading attributes
 * @param {Array} imageEntries o array de imagens
 */
function updateResponsiveImages(imageEntries) {
  const currentIdx = getResponsiveImageIndex(imageEntries.length);
  imageEntries.forEach(({
    idx, picture, parent, img,
  }) => {
    if (idx === currentIdx) {
      if (!parent.contains(picture)) {
        parent.appendChild(picture);
      }
      /* Defina loading='eager' somente se estiver dentro de um bloco Hero,
       porque presumo que este seja o primeiro bloco da página.
       Only set loading='eager' if inside a Hero block becauseI assume
       this block is above the fold and contains the first image.
       */
      const heroBlock = picture.closest('.hero');
      if (img && heroBlock) img.setAttribute('loading', 'eager');
    } else if (parent.contains(picture)) {
      parent.removeChild(picture);
    }
  });
}

export function prepareResponsivePictures(bgImagesDiv) {
  const pictures = bgImagesDiv.querySelectorAll('picture');
  if (pictures.length >= 2) {
    pictures.forEach((picture, idx) => {
      if (idx === 0) picture.parentElement.classList.add('mobile');
      if (idx === 1) picture.parentElement.classList.add('tablet');
      if (idx === 2) picture.parentElement.classList.add('desktop');
    });

    const imageEntries = getResponsiveImageEntries(pictures);
    updateResponsiveImages(imageEntries);

    let resizeTimeout;
    window.addEventListener('resize', () => {
      clearTimeout(resizeTimeout);
      resizeTimeout = setTimeout(updateResponsiveImages(imageEntries), 100);
    });
  }
}

/**
 * Decorates the main element.
 * @param {Element} main The main element
 */
// eslint-disable-next-line import/prefer-default-export
export function decorateMain(main) {
  // hopefully forward compatible button decoration
  decorateButtons(main);
  decorateIcons(main);
  decorateLinkedPictures(main);
  buildAutoBlocks(main);
  decorateSections(main);
  decorateBlocks(main);
}

/**
 * Loads everything needed to get to LCP.
 * @param {Element} doc The container element
 */
async function loadEager(doc) {
  document.documentElement.lang = 'en';
  decorateTemplateAndTheme();
  const main = doc.querySelector('main');
  if (main) {
    decorateMain(main);
    document.body.classList.add('appear');
    await loadSection(main.querySelector('.section'), waitForFirstImage);
  }

  try {
    /* if desktop (proxy for fast connection) or fonts already loaded, load fonts.css */
    if (window.innerWidth >= 900 || sessionStorage.getItem('fonts-loaded')) {
      loadFonts();
    }
  } catch (e) {
    // do nothing
  }
}

/**
 * Loads everything that doesn't need to be delayed.
 * @param {Element} doc The container element
 */
async function loadLazy(doc) {
  const main = doc.querySelector('main');
  await loadSections(main);

  const { hash } = window.location;
  const element = hash ? doc.getElementById(hash.substring(1)) : false;
  if (hash && element) element.scrollIntoView();

  loadHeader(doc.querySelector('header'));
  loadFooter(doc.querySelector('footer'));

  loadCSS(`${window.hlx.codeBasePath}/styles/lazy-styles.css`);
  loadFonts();
}

/**
 * Loads everything that happens a lot later,
 * without impacting the user experience.
 */
function loadDelayed() {
  // eslint-disable-next-line import/no-cycle
  window.setTimeout(() => import('./delayed.js'), 3000);
  // load anything that can be postponed to the latest here
}

async function loadPage() {
  await loadEager(document);
  await loadLazy(document);
  loadDelayed();
}

loadPage();

const { searchParams, origin } = new URL(window.location.href);
const branch = searchParams.get('nx') || 'main';

export const NX_ORIGIN = branch === 'local' || origin.includes('localhost') ? 'http://localhost:6456/nx' : 'https://da.live/nx';

(async function loadDa() {
  /* eslint-disable import/no-unresolved */
  if (searchParams.get('dapreview')) {
    import('https://da.live/scripts/dapreview.js')
      .then(({ default: daPreview }) => daPreview(loadPage));
  }
  if (searchParams.get('daexperiment')) {
    import(`${NX_ORIGIN}/public/plugins/exp/exp.js`);
  }
}());
