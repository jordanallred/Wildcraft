/* Wildcraft Theme */
(function () {
  'use strict';

  /* ========================
     Utilities
  ======================== */

  /* Follow the shop's own currency format rather than assuming dollars.
     layout/theme.liquid puts shop.money_format on <body>. */
  const MONEY_FORMAT = document.body.dataset.moneyFormat || '${{amount}}';

  function formatMoney(cents) {
    const n = (cents || 0) / 100;
    const group = (v, sep) => v.replace(/\B(?=(\d{3})+(?!\d))/g, sep);

    return MONEY_FORMAT.replace(/\{\{\s*(\w+)\s*\}\}/g, (_, name) => {
      switch (name) {
        case 'amount_no_decimals':
          return group(Math.round(n).toString(), ',');
        case 'amount_with_comma_separator': {
          const [whole, frac] = n.toFixed(2).split('.');
          return group(whole, '.') + ',' + frac;
        }
        case 'amount_no_decimals_with_comma_separator':
          return group(Math.round(n).toString(), '.');
        default:
          return group(n.toFixed(2), ',');
      }
    });
  }

  /* Product titles are merchant-controlled, but they still land in innerHTML
     below, so escape rather than trust. */
  const ESCAPES = { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' };
  function esc(value) {
    return String(value == null ? '' : value).replace(/[&<>"']/g, c => ESCAPES[c]);
  }

  function updateCartBadge(count) {
    document.querySelectorAll('.cart-count__badge').forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('is-visible', count > 0);
    });
  }

  /* ========================
     Cart Drawer
  ======================== */
  const cartDrawer = {
    el: document.getElementById('cart-drawer'),
    body: document.getElementById('cart-drawer-body'),
    footer: document.getElementById('cart-drawer-footer'),
    subtotalEl: document.getElementById('cart-drawer-subtotal'),

    open() {
      if (!this.el) return;
      this.el.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      this.refresh();
    },

    close() {
      if (!this.el) return;
      this.el.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
    },

    async refresh() {
      try {
        const res = await fetch('/cart.js');
        const cart = await res.json();
        this.render(cart);
      } catch (e) {
        console.error('[Wildcraft] Cart fetch failed', e);
      }
    },

    render(cart) {
      if (!this.body || !this.footer) return;

      if (cart.item_count === 0) {
        this.body.innerHTML =
          '<div class="cart-drawer__empty">' +
            '<p>Your cart is empty.</p>' +
            '<a href="/collections/all" class="btn btn--outline btn--sm">Browse the buttons</a>' +
          '</div>';
        this.footer.hidden = true;
        updateCartBadge(0);
        return;
      }

      this.body.innerHTML = cart.items.map(item => `
        <div class="cart-item" data-line="${esc(item.key)}">
          <div class="cart-item__image">
            ${item.image ? `<img src="${esc(item.image)}" alt="" loading="lazy">` : ''}
          </div>
          <div class="cart-item__info">
            <div class="cart-item__title">${esc(item.product_title)}</div>
            ${item.variant_title && item.variant_title !== 'Default Title' ? `<div class="cart-item__variant">${esc(item.variant_title)}</div>` : ''}
            <div class="cart-item__quantity">
              <button class="cart-item__qty-btn" data-action="decrease" data-line="${esc(item.key)}" aria-label="Decrease quantity of ${esc(item.product_title)}">−</button>
              <span class="cart-item__qty-value">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="increase" data-line="${esc(item.key)}" aria-label="Increase quantity of ${esc(item.product_title)}">+</button>
              <button class="cart-table__remove" data-action="remove" data-line="${esc(item.key)}">Remove</button>
            </div>
          </div>
          <div class="cart-item__price">${formatMoney(item.final_line_price)}</div>
        </div>
      `).join('');

      if (this.subtotalEl) this.subtotalEl.textContent = formatMoney(cart.total_price);
      this.footer.hidden = false;
      updateCartBadge(cart.item_count);
    }
  };

  /* Cart item quantity changes */
  document.addEventListener('click', e => {
    const qtyBtn = e.target.closest('.cart-item__qty-btn, .cart-table__remove');
    if (!qtyBtn) return;

    const action = qtyBtn.dataset.action;
    const key = qtyBtn.dataset.line;
    const item = qtyBtn.closest('.cart-item');
    const currentQty = parseInt(item?.querySelector('.cart-item__qty-value')?.textContent || '1', 10);

    let newQty = currentQty;
    if (action === 'increase') newQty += 1;
    else if (action === 'decrease') newQty = Math.max(0, newQty - 1);
    else if (action === 'remove') newQty = 0;

    updateCartItem(key, newQty);
  });

  async function updateCartItem(key, qty) {
    try {
      const res = await fetch('/cart/change.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      const cart = await res.json();
      cartDrawer.render(cart);
    } catch (e) {
      console.error('[Wildcraft] Cart update failed', e);
    }
  }

  /* Open/close events */
  document.addEventListener('click', e => {
    if (e.target.closest('[data-cart-trigger]')) {
      e.preventDefault();
      cartDrawer.open();
      return;
    }
    if (e.target.closest('.cart-drawer__close, .cart-drawer__overlay')) {
      cartDrawer.close();
    }
  });

  /* ========================
     Add to Cart (product form)
  ======================== */
  document.addEventListener('submit', async e => {
    const form = e.target.closest('[data-product-form]');
    if (!form) return;
    e.preventDefault();

    const submitBtn = form.querySelector('[data-add-to-cart]');
    const originalText = submitBtn?.textContent;
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding…';
    }

    try {
      const variantId = form.querySelector('[name="id"]')?.value;
      const quantity = parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10);

      if (!variantId) throw new Error('No variant selected');

      const res = await fetch('/cart/add.js', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });

      if (!res.ok) throw new Error('Add to cart failed');

      cartDrawer.open();
    } catch (err) {
      console.error('[Wildcraft] Add to cart error:', err);
    } finally {
      if (submitBtn) {
        submitBtn.disabled = false;
        submitBtn.textContent = originalText;
      }
    }
  });

  /* ========================
     Variant Selection
     Reads product.variants JSON embedded in the page,
     matches the current selected options to the right variant ID,
     and updates the hidden form input + price display.
  ======================== */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.variant-btn:not(.is-unavailable)');
    if (!btn) return;

    const sectionId = btn.dataset.sectionId;
    const optionIndex = parseInt(btn.dataset.optionIndex, 10);
    const value = btn.dataset.value;

    /* Update visual state for this option group */
    btn.closest('.variant-buttons')?.querySelectorAll('.variant-btn').forEach(b => b.classList.remove('is-selected'));
    btn.classList.add('is-selected');

    /* Update label display */
    const labelValue = document.getElementById(`option-value-${sectionId}-${optionIndex}`);
    if (labelValue) labelValue.textContent = value;

    /* Collect all currently selected option values */
    const form = btn.closest('[data-product-form]');
    if (!form) return;

    const selectedOptions = [];
    form.querySelectorAll('.variant-buttons').forEach(group => {
      const sel = group.querySelector('.variant-btn.is-selected');
      if (sel) selectedOptions.push(sel.dataset.value);
    });

    /* Find matching variant from embedded JSON */
    const variantsEl = document.getElementById(`ProductVariants-${sectionId}`);
    if (!variantsEl) return;

    let variants;
    try { variants = JSON.parse(variantsEl.textContent); }
    catch { return; }

    const matched = variants.find(v =>
      v.options.length === selectedOptions.length &&
      v.options.every((opt, i) => opt === selectedOptions[i])
    );

    if (!matched) return;

    /* Update hidden variant ID input */
    const idInput = document.getElementById(`product-variant-id-${sectionId}`);
    if (idInput) idInput.value = matched.id;

    /* Update price display */
    const priceEl = document.getElementById(`product-price-${sectionId}`);
    if (priceEl) {
      const currentEl = priceEl.querySelector('.product-info__price-current');
      const compareEl = priceEl.querySelector('.product-info__price-compare');

      if (currentEl) currentEl.textContent = formatMoney(matched.price);
      if (matched.compare_at_price > matched.price) {
        priceEl.classList.add('product-info__price--sale');
        if (compareEl) compareEl.textContent = formatMoney(matched.compare_at_price);
        else priceEl.insertAdjacentHTML('beforeend', `<span class="product-info__price-compare">${formatMoney(matched.compare_at_price)}</span>`);
      } else {
        priceEl.classList.remove('product-info__price--sale');
        compareEl?.remove();
      }
    }

    /* Update submit button */
    const submitBtn = document.getElementById(`product-submit-${sectionId}`);
    if (submitBtn) {
      submitBtn.disabled = !matched.available;
      submitBtn.textContent = matched.available
        ? `Add to cart — ${formatMoney(matched.price)}`
        : 'Sold out';
    }

    /* Keep the sold-out note in step with the button */
    const note = document.getElementById(`product-note-${sectionId}`);
    if (note) note.hidden = matched.available;

    /* Mark unavailable variants in other option groups */
    form.querySelectorAll('.variant-btn').forEach(b => {
      if (b === btn || b.dataset.optionIndex === btn.dataset.optionIndex) return;
      const testOptions = [...selectedOptions];
      const idx = parseInt(b.dataset.optionIndex, 10);
      testOptions[idx] = b.dataset.value;
      const exists = variants.some(v =>
        v.options.every((opt, i) => opt === testOptions[i]) && v.available
      );
      b.classList.toggle('is-unavailable', !exists);
    });
  });

  /* ========================
     Quantity Stepper (product page)
  ======================== */
  document.addEventListener('click', e => {
    const btn = e.target.closest('.product-form__qty-btn');
    if (!btn) return;
    const input = btn.closest('.product-form__quantity')?.querySelector('.product-form__qty-input');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    if (btn.dataset.action === 'increase') val = Math.min(val + 1, 99);
    if (btn.dataset.action === 'decrease') val = Math.max(val - 1, 1);
    input.value = val;
  });

  /* ========================
     Product Gallery Thumbnails
  ======================== */
  document.addEventListener('click', e => {
    const thumb = e.target.closest('.product-gallery__thumb');
    if (!thumb) return;
    const gallery = thumb.closest('.product-gallery');
    const main = gallery?.querySelector('.product-gallery__main img');
    if (!main) return;
    gallery.querySelectorAll('.product-gallery__thumb').forEach(t => t.classList.remove('is-active'));
    thumb.classList.add('is-active');
    const src = thumb.querySelector('img')?.src;
    if (src) { main.src = src; main.alt = thumb.querySelector('img')?.alt || ''; }
  });

  /* ========================
     Mobile Navigation
     Uses .mobile-nav__overlay / .mobile-nav__close — separate from cart drawer
  ======================== */
  const mobileToggle = document.querySelector('.mobile-menu-toggle');
  const mobileNav = document.querySelector('.mobile-nav');

  function openMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.add('is-open');
    mobileNav.setAttribute('aria-hidden', 'false');
    mobileToggle?.setAttribute('aria-expanded', 'true');
    document.body.style.overflow = 'hidden';
  }

  function closeMobileNav() {
    if (!mobileNav) return;
    mobileNav.classList.remove('is-open');
    mobileNav.setAttribute('aria-hidden', 'true');
    mobileToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', openMobileNav);

  document.addEventListener('click', e => {
    if (e.target.closest('.mobile-nav__overlay') || e.target.closest('.mobile-nav__close')) {
      closeMobileNav();
    }
  });

  /* ========================
     Nav Submenus (snippets/nav-tree.liquid)
     One handler for both navs — the markup is shared, only the CSS differs.
     The .is-open class is the single source of truth so aria-expanded never
     disagrees with what's on screen; that's why hover is done here and not
     with a CSS :hover rule that the class couldn't override.
  ======================== */
  const hoverCapable = window.matchMedia('(hover: hover) and (pointer: fine)');
  const DESKTOP_ITEM = '.site-header__nav .nav-tree__item.has-submenu';

  function setSubmenu(item, open) {
    if (!item) return;
    item.classList.toggle('is-open', open);
    item.querySelector('.nav-tree__toggle')?.setAttribute('aria-expanded', String(open));
  }

  /* Desktop panels float over each other, so only one may be open at a time.
     The mobile drawer is a stack of accordions — collapsing one section
     because the user opened another just makes them scroll back. Hence the
     scope argument: mutual exclusion is a desktop-only rule, not a global one. */
  function closeSubmenus(scope, except) {
    (scope || document).querySelectorAll('.nav-tree__item.is-open').forEach(item => {
      if (item !== except) setSubmenu(item, false);
    });
  }

  const desktopNav = () => document.querySelector('.site-header__nav');

  document.addEventListener('click', e => {
    const toggle = e.target.closest('[data-submenu-toggle]');
    if (toggle) {
      const item = toggle.closest('.nav-tree__item');
      const willOpen = !item.classList.contains('is-open');
      if (item.closest('.site-header__nav')) closeSubmenus(desktopNav(), item);
      setSubmenu(item, willOpen);
      return;
    }
    /* A click anywhere off the nav closes any open dropdown */
    if (!e.target.closest('.nav-tree__item')) closeSubmenus(desktopNav());
  });

  document.addEventListener('mouseover', e => {
    if (!hoverCapable.matches) return;
    const item = e.target.closest(DESKTOP_ITEM);
    if (!item || item.classList.contains('is-open')) return;
    closeSubmenus(desktopNav(), item);
    setSubmenu(item, true);
  });

  document.addEventListener('mouseout', e => {
    if (!hoverCapable.matches) return;
    const item = e.target.closest(DESKTOP_ITEM);
    if (!item || item.contains(e.relatedTarget)) return;
    setSubmenu(item, false);
  });

  /* Tabbing out of a dropdown closes it behind you. relatedTarget is where
     focus is going, so this resolves now — document.activeElement isn't
     updated yet during focusout, and deferring to a frame would leave the
     panel stuck open in a tab that isn't painting. A null relatedTarget
     means focus left the document entirely, which also closes. */
  document.addEventListener('focusout', e => {
    const item = e.target.closest(DESKTOP_ITEM);
    if (!item || !item.classList.contains('is-open')) return;
    if (!item.contains(e.relatedTarget)) setSubmenu(item, false);
  });

  /* ========================
     Escape key closes everything
  ======================== */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    /* Escape inside an open dropdown closes just that one, and puts focus
       back on its toggle — bailing to the cart drawer would lose the user's
       place in the nav. */
    const openItem = document.activeElement?.closest?.('.nav-tree__item.is-open');
    if (openItem) {
      setSubmenu(openItem, false);
      openItem.querySelector('.nav-tree__toggle')?.focus();
      return;
    }
    closeSubmenus();
    cartDrawer.close();
    closeMobileNav();
  });

  /* Initial cart badge */
  fetch('/cart.js')
    .then(r => r.json())
    .then(cart => updateCartBadge(cart.item_count))
    .catch(() => {});

  /* ========================
     Sticky Add-to-Cart (mobile product page)
  ======================== */
  const stickyBar = document.getElementById('product-sticky-bar');
  const mainAddToCart = document.querySelector('[data-add-to-cart]');
  if (stickyBar && mainAddToCart) {
    const stickyBtn = document.getElementById('sticky-add-to-cart');

    const barObserver = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting;
      stickyBar.classList.toggle('is-visible', show);
      stickyBar.setAttribute('aria-hidden', String(!show));
    }, { rootMargin: '-60px 0px 0px 0px' });

    barObserver.observe(mainAddToCart);

    stickyBtn?.addEventListener('click', () => mainAddToCart.click());
  }

  /* ========================
     Header scroll state
  ======================== */
  const header = document.querySelector('.site-header');
  if (header) {
    const onScroll = () => header.classList.toggle('is-scrolled', window.scrollY > 20);
    window.addEventListener('scroll', onScroll, { passive: true });
    onScroll();
  }

  /* ========================
     Scroll Reveal
     Only animates elements that start below the viewport.
  ======================== */
  function initReveal() {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return;

    const selectors = [
      '.section-header',
      '.feature-item',
      '.about-banner__image',
      '.about-banner__content',
      '.newsletter .section-header',
      '.social-grid__item',
    ].join(',');

    /* threshold 0 with a positive rootMargin, so an element starts revealing
       just before it enters. At threshold 0.1 a tall section had to be a
       tenth visible before un-hiding, which left the About banner blank
       through a fast scroll. */
    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0, rootMargin: '0px 0px 80px 0px' });

    document.querySelectorAll(selectors).forEach(el => {
      const rect = el.getBoundingClientRect();
      if (rect.top >= window.innerHeight) {
        el.classList.add('reveal');
        observer.observe(el);
      }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', initReveal);
  } else {
    initReveal();
  }
})();
