/* Wildcraft Theme */
(function () {
  'use strict';

  /* ========================
     Utilities
  ======================== */
  function formatMoney(cents) {
    return '$' + (cents / 100).toFixed(2);
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
        this.body.innerHTML = '<p class="cart-drawer__empty">Your cart is empty.</p>';
        this.footer.hidden = true;
        updateCartBadge(0);
        return;
      }

      this.body.innerHTML = cart.items.map(item => `
        <div class="cart-item" data-line="${item.key}">
          <div class="cart-item__image">
            ${item.image ? `<img src="${item.image}" alt="${item.product_title}" loading="lazy">` : ''}
          </div>
          <div class="cart-item__info">
            <div class="cart-item__title">${item.product_title}</div>
            ${item.variant_title && item.variant_title !== 'Default Title' ? `<div class="cart-item__variant">${item.variant_title}</div>` : ''}
            <div class="cart-item__quantity">
              <button class="cart-item__qty-btn" data-action="decrease" data-line="${item.key}" aria-label="Decrease quantity">−</button>
              <span class="cart-item__qty-value">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="increase" data-line="${item.key}" aria-label="Increase quantity">+</button>
              <button class="cart-table__remove" data-action="remove" data-line="${item.key}">Remove</button>
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
        ? `Add to Cart — ${formatMoney(matched.price)}`
        : 'Sold Out';
    }

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
     Escape key closes everything
  ======================== */
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
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
    ].join(',');

    const observer = new IntersectionObserver((entries) => {
      entries.forEach(entry => {
        if (entry.isIntersecting) {
          entry.target.classList.add('is-visible');
          observer.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -30px 0px' });

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
