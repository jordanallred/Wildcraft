/* Wildcraft Theme */
(function () {
  'use strict';

  /* ========================
     Utilities
  ======================== */

  /* Follow the shop's own currency format rather than assuming dollars.
     layout/theme.liquid puts shop.money_format on <body>. */
  const MONEY_FORMAT = document.body.dataset.moneyFormat || '${{amount}}';

  /* Cart endpoints come from the routes object via <body>, not from string
     literals here — they pick up a locale or market prefix if the shop ever
     adds one, and a path baked into this file never would. */
  const ROUTES = {
    cart:       document.body.dataset.cartUrl || '/cart',
    cartJs:     (document.body.dataset.cartUrl || '/cart') + '.js',
    add:        (document.body.dataset.cartAddUrl || '/cart/add') + '.js',
    change:     (document.body.dataset.cartChangeUrl || '/cart/change') + '.js',
    allProducts: document.body.dataset.allProductsUrl || '/collections/all'
  };

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

  /* The badge is aria-hidden — the count lives on the trigger's label — so
     both have to move together or a screen reader keeps announcing the count
     the page was served with. */
  function updateCartBadge(count) {
    document.querySelectorAll('.cart-count__badge').forEach(badge => {
      badge.textContent = count;
      badge.classList.toggle('is-visible', count > 0);
    });
    document.querySelectorAll('[data-cart-trigger]').forEach(trigger => {
      trigger.setAttribute('aria-label', `Open cart, ${count} item${count === 1 ? '' : 's'}`);
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

    /* The panel is only moved off-screen with a transform, so without `inert`
       its Close/Checkout/View-cart controls stay in the tab order on every
       page of the shop — a keyboard user tabs into an invisible dialog. inert
       removes them from focus and from the accessibility tree together, which
       also settles the aria-hidden-on-focusable-content contradiction. */
    open() {
      if (!this.el) return;
      this.returnFocusTo = document.activeElement;
      this.el.removeAttribute('inert');
      this.el.setAttribute('aria-hidden', 'false');
      document.body.style.overflow = 'hidden';
      this.refresh();
      /* Focus the close button so the dialog, not the page behind it, is
         where the next Tab goes. */
      this.el.querySelector('.cart-drawer__close')?.focus();
    },

    close() {
      if (!this.el) return;
      this.el.setAttribute('aria-hidden', 'true');
      document.body.style.overflow = '';
      /* Blur before going inert: inert on an ancestor of the focused element
         drops focus to <body>, which loses the user's place in the page. */
      if (this.el.contains(document.activeElement)) {
        this.returnFocusTo instanceof HTMLElement ? this.returnFocusTo.focus() : document.activeElement.blur();
      }
      this.el.setAttribute('inert', '');
      this.returnFocusTo = null;
    },

    get isOpen() {
      return this.el?.getAttribute('aria-hidden') === 'false';
    },

    /* Stock limits are the common rejection here, so the message goes at the
       top of the drawer body where the affected line is, not in a toast that
       drifts away from what it refers to. */
    showError(message) {
      if (!this.body) return;
      let el = this.body.querySelector('.cart-drawer__error');
      if (!el) {
        el = document.createElement('p');
        el.className = 'cart-drawer__error';
        el.setAttribute('role', 'alert');
        this.body.prepend(el);
      }
      el.textContent = message;
    },

    /* A dialog has to cycle. inert keeps the panel out of the tab order while
       it's closed, but once open, Tab from the last control walked straight
       out into the page behind — which is still open behind an overlay the
       user can't see past. Focus wraps at both ends instead. */
    trapFocus(e) {
      if (e.key !== 'Tab' || !this.isOpen || !this.el) return;

      const focusable = [...this.el.querySelectorAll(
        'a[href], button:not([disabled]), input:not([disabled]), textarea:not([disabled]), select:not([disabled]), [tabindex]:not([tabindex="-1"])'
      )].filter(el => el.offsetParent !== null || el === document.activeElement);

      if (focusable.length === 0) return;

      const first = focusable[0];
      const last = focusable[focusable.length - 1];

      if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
      } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
      }
    },

    async refresh() {
      try {
        const res = await fetch(ROUTES.cartJs);
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
            `<a href="${esc(ROUTES.allProducts)}" class="btn btn--outline btn--sm">Browse the buttons</a>` +
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
            <div class="cart-item__title"><a href="${esc(item.url)}">${esc(item.product_title)}</a></div>
            ${item.variant_title && item.variant_title !== 'Default Title' ? `<div class="cart-item__variant">${esc(item.variant_title)}</div>` : ''}
            <div class="cart-item__quantity">
              <button class="cart-item__qty-btn" data-action="decrease" data-line="${esc(item.key)}" aria-label="Decrease quantity of ${esc(item.product_title)}">−</button>
              <span class="cart-item__qty-value">${item.quantity}</span>
              <button class="cart-item__qty-btn" data-action="increase" data-line="${esc(item.key)}" aria-label="Increase quantity of ${esc(item.product_title)}">+</button>
              <button class="cart-item__remove" data-action="remove" data-line="${esc(item.key)}" aria-label="Remove ${esc(item.product_title)}">Remove</button>
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

  /* Cart item quantity changes, drawer only.
     This used to match `.cart-table__remove` too, which is the Remove link on
     the /cart page — an <a> with no data-line. It fired a POST to
     /cart/change.js with `id: undefined` on every removal, racing the link's
     own navigation, and then re-rendered the drawer rather than the page the
     customer was actually looking at. The cart page has its own handler
     further down; this one stays inside the drawer. */
  document.addEventListener('click', e => {
    const qtyBtn = e.target.closest('#cart-drawer .cart-item__qty-btn, #cart-drawer .cart-item__remove');
    if (!qtyBtn) return;

    const action = qtyBtn.dataset.action;
    const key = qtyBtn.dataset.line;
    if (!key) return;

    const item = qtyBtn.closest('.cart-item');
    const currentQty = parseInt(item?.querySelector('.cart-item__qty-value')?.textContent || '1', 10);

    let newQty = currentQty;
    if (action === 'increase') newQty += 1;
    else if (action === 'decrease') newQty = Math.max(0, newQty - 1);
    else if (action === 'remove') newQty = 0;
    else return;

    updateCartItem(key, newQty);
  });

  async function updateCartItem(key, qty) {
    try {
      const res = await fetch(ROUTES.change, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: key, quantity: qty })
      });
      const data = await res.json();

      /* Asking for more than is in stock comes back 422 with an error body,
         not a cart. Without this check that body went straight into render(),
         where `data.items` is undefined and the map throws — so pressing "+"
         past the stock limit silently emptied the drawer's markup instead of
         saying why. Shopify's message is specific ("You can only add 1 of
         this to your cart"), so it's worth showing rather than swallowing. */
      if (!res.ok) {
        const message = data?.description || data?.message || 'That change could not be applied.';
        /* Re-read the cart first — render() rewrites the drawer body, so
           showing the message before that would wipe it immediately. */
        await cartDrawer.refresh();
        cartDrawer.showError(message);
        return;
      }

      cartDrawer.render(data);
    } catch (e) {
      console.error('[Wildcraft] Cart update failed', e);
    }
  }

  /* ========================
     Cart Page (/cart)
     The steppers and Remove links post through the cart form on their own if
     this never runs. When it does, each change goes to /cart/change.js and the
     section is re-rendered from the server — totals, discounts, and the free
     shipping bar are all computed in Liquid, so asking Shopify for fresh HTML
     is the only way they stay right. Working them out in JS would drift the
     first time a discount code is in play.
  ======================== */
  const cartForm = document.querySelector('.cart-form');

  if (cartForm) {
    const sectionEl = cartForm.closest('.shopify-section');
    /* The section's id comes from templates/cart.json, via the wrapper
       Shopify emits: shopify-section-main → "main". */
    const sectionId = sectionEl?.id.replace(/^shopify-section-/, '');

    async function renderCartSection() {
      if (!sectionId || !sectionEl) { window.location.reload(); return; }
      const res = await fetch(`${window.location.pathname}?sections=${encodeURIComponent(sectionId)}`);
      const data = await res.json();
      const html = data[sectionId];
      if (typeof html !== 'string') { window.location.reload(); return; }

      const fresh = new DOMParser().parseFromString(html, 'text/html')
        .getElementById(sectionEl.id);
      if (!fresh) { window.location.reload(); return; }
      sectionEl.innerHTML = fresh.innerHTML;
    }

    async function changeCartLine(key, qty, busyEl) {
      busyEl?.classList.add('is-busy');
      try {
        const res = await fetch(ROUTES.change, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ id: key, quantity: qty })
        });
        if (!res.ok) throw new Error(`change.js ${res.status}`);
        const cart = await res.json();
        updateCartBadge(cart.item_count);
        await renderCartSection();
      } catch (err) {
        /* Let the browser do what it would have done without JS rather than
           leaving the row stuck mid-update with no explanation. */
        console.error('[Wildcraft] Cart page update failed', err);
        window.location.reload();
      }
    }

    document.addEventListener('click', e => {
      const stepper = e.target.closest('[data-cart-qty]');
      if (stepper) {
        const row = stepper.closest('.cart-table__row');
        const input = row?.querySelector('.cart-qty__input');
        if (!input) return;
        const current = parseInt(input.value, 10) || 0;
        const next = stepper.dataset.cartQty === 'increase'
          ? current + 1
          : Math.max(0, current - 1);
        input.value = next;
        changeCartLine(input.dataset.lineKey, next, row);
        return;
      }

      const remove = e.target.closest('[data-cart-remove]');
      if (remove) {
        e.preventDefault();
        changeCartLine(remove.dataset.lineKey, 0, remove.closest('.cart-table__row'));
      }
    });

    /* Typing straight into the box, rather than using the steppers. */
    document.addEventListener('change', e => {
      const input = e.target.closest('.cart-qty__input');
      if (!input) return;
      const qty = Math.max(0, parseInt(input.value, 10) || 0);
      input.value = qty;
      changeCartLine(input.dataset.lineKey, qty, input.closest('.cart-table__row'));
    });
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
    const errorEl = form.querySelector('[data-add-to-cart-error]');

    if (errorEl) { errorEl.textContent = ''; errorEl.hidden = true; }
    if (submitBtn) {
      submitBtn.disabled = true;
      submitBtn.textContent = 'Adding…';
    }

    try {
      const variantId = form.querySelector('[name="id"]')?.value;
      const quantity = parseInt(form.querySelector('[name="quantity"]')?.value || '1', 10);

      if (!variantId) throw new Error('Please choose an option first.');

      const res = await fetch(ROUTES.add, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: variantId, quantity })
      });

      /* A rejected add is the common case, not an exotic one: stock runs out
         between page load and click, or someone asks for more than is left.
         Shopify explains why in the body — showing that beats the silent
         console.error this used to do, where the button reset itself and the
         customer was left guessing whether anything happened. */
      const data = await res.json().catch(() => null);
      if (!res.ok) {
        throw new Error(data?.description || data?.message || 'Sorry — that could not be added to your cart.');
      }

      cartDrawer.open();
    } catch (err) {
      console.error('[Wildcraft] Add to cart error:', err);
      if (errorEl) {
        errorEl.textContent = err.message;
        errorEl.hidden = false;
      }
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

    /* The sticky bar is a second copy of the price and the buy button, so it
       has to follow the same variant. It was rendered once in Liquid and never
       touched again — pick a $14 variant on a page that opens at $9 and the
       bar kept quoting $9 all the way down the page. */
    const stickyPrice = document.querySelector('.product-sticky-bar__price');
    if (stickyPrice) stickyPrice.textContent = formatMoney(matched.price);
    const stickyBtn = document.getElementById('sticky-add-to-cart');
    if (stickyBtn) {
      stickyBtn.disabled = !matched.available;
      stickyBtn.textContent = matched.available ? 'Add to Cart' : 'Sold out';
    }

    /* Clear a stale "could not be added" message once the choice changes. */
    const addError = form.querySelector('[data-add-to-cart-error]');
    if (addError) { addError.textContent = ''; addError.hidden = true; }

    /* Stock differs per variant, so the quantity ceiling has to move with the
       selection — otherwise picking a variant with one left keeps whatever
       ceiling the previously selected one had. */
    const invEl = document.getElementById(`ProductInventory-${sectionId}`);
    const qtyInput = form.querySelector('.product-form__qty-input');
    if (invEl && qtyInput) {
      let caps;
      try { caps = JSON.parse(invEl.textContent); } catch { caps = null; }
      const cap = caps ? caps[matched.id] : null;
      qtyInput.max = (cap === null || cap === undefined) ? 99 : Math.max(cap, 1);
      if ((parseInt(qtyInput.value, 10) || 1) > qtyCeiling(qtyInput)) {
        qtyInput.value = qtyCeiling(qtyInput);
      }
      showQtyLimit(qtyInput);
    }

    markUnavailable(form, variants, selectedOptions, btn.dataset.optionIndex);
  });

  /* Grey out option values that can't be reached from the current selection.
     Extracted from the click handler because it also has to run on load —
     before this, a page opened with every combination looking available and
     only revealed the impossible ones after you'd already clicked something. */
  function markUnavailable(form, variants, selectedOptions, skipIndex) {
    form.querySelectorAll('.variant-btn').forEach(b => {
      if (b.dataset.optionIndex === skipIndex) return;
      const testOptions = [...selectedOptions];
      const idx = parseInt(b.dataset.optionIndex, 10);
      testOptions[idx] = b.dataset.value;
      const exists = variants.some(v =>
        v.options.every((opt, i) => opt === testOptions[i]) && v.available
      );
      b.classList.toggle('is-unavailable', !exists);
    });
  }

  document.querySelectorAll('[data-product-form]').forEach(form => {
    /* Say "only one left" on arrival, not just after someone pushes the
       button and finds it won't move. */
    const qtyInput = form.querySelector('.product-form__qty-input');
    if (qtyInput) showQtyLimit(qtyInput);

    const sectionId = form.dataset.sectionId;
    const variantsEl = document.getElementById(`ProductVariants-${sectionId}`);
    if (!variantsEl) return;

    let variants;
    try { variants = JSON.parse(variantsEl.textContent); }
    catch { return; }

    const selectedOptions = [];
    form.querySelectorAll('.variant-buttons').forEach(group => {
      const sel = group.querySelector('.variant-btn.is-selected');
      if (sel) selectedOptions.push(sel.dataset.value);
    });
    if (selectedOptions.length === 0) return;

    /* No skipIndex on load: nothing was just clicked, so every group is fair
       game for marking. */
    markUnavailable(form, variants, selectedOptions, null);
  });

  /* ========================
     Quantity Stepper (product page)
  ======================== */
  /* The ceiling comes from the input's own max, which Liquid sets to real
     stock — it was a hardcoded 99 here, so the stepper climbed past whatever
     the markup said and left Shopify to reject the order later. */
  function qtyCeiling(input) {
    const max = parseInt(input.max, 10);
    return Number.isFinite(max) && max > 0 ? max : 99;
  }

  function showQtyLimit(input) {
    /* Scoped to the form, not `input.closest('div')` — that resolved to
       .product-form__quantity, which wraps the stepper but not the note
       sitting beside it, so the lookup always came back null and the message
       never appeared however hard you pushed the button. */
    const note = input.form?.querySelector('[data-qty-limit]');
    if (!note) return;

    /* Nothing to say about scarcity when there is nothing to buy. A sold-out
       variant has inventory 0, and the Liquid floors the input's max at 1 so
       the stepper stays usable — which read as "Only one of these left" on a
       page whose button says Sold out. */
    const submit = input.form?.querySelector('[data-add-to-cart]');
    if (submit && submit.disabled) {
      note.textContent = '';
      note.hidden = true;
      return;
    }

    const max = qtyCeiling(input);
    const atLimit = (parseInt(input.value, 10) || 1) >= max && max < 99;
    note.textContent = atLimit
      ? (max === 1 ? 'Only one of these left.' : `Only ${max} of these left.`)
      : '';
    note.hidden = !atLimit;
  }

  document.addEventListener('click', e => {
    const btn = e.target.closest('.product-form__qty-btn');
    if (!btn) return;
    const input = btn.closest('.product-form__quantity')?.querySelector('.product-form__qty-input');
    if (!input) return;
    let val = parseInt(input.value, 10) || 1;
    if (btn.dataset.action === 'increase') val = Math.min(val + 1, qtyCeiling(input));
    if (btn.dataset.action === 'decrease') val = Math.max(val - 1, 1);
    input.value = val;
    showQtyLimit(input);
  });

  /* Typing straight into the box has to respect the same ceiling. */
  document.addEventListener('change', e => {
    const input = e.target.closest('.product-form__qty-input');
    if (!input) return;
    const val = parseInt(input.value, 10) || 1;
    input.value = Math.min(Math.max(val, 1), qtyCeiling(input));
    showQtyLimit(input);
  });

  /* ========================
     Product Gallery Thumbnails
  ======================== */
  /* The full-size sources are stamped on each thumb by main-product.liquid.
     Reading the thumbnail's own `src` instead — which is what this did — put a
     200px-wide file into a slot rendered at up to 1000px, so every product
     photo after the first one was visibly soft. The srcset has to be replaced
     along with the src, or the browser keeps serving candidates from the
     image it is replacing. */
  document.addEventListener('click', e => {
    const thumb = e.target.closest('.product-gallery__thumb');
    if (!thumb) return;
    const gallery = thumb.closest('.product-gallery');
    const main = gallery?.querySelector('.product-gallery__main img');
    if (!main) return;

    gallery.querySelectorAll('.product-gallery__thumb').forEach(t => {
      t.classList.remove('is-active');
      t.setAttribute('aria-pressed', 'false');
    });
    thumb.classList.add('is-active');
    thumb.setAttribute('aria-pressed', 'true');

    const full = thumb.dataset.fullSrc;
    if (!full) return;
    main.srcset = thumb.dataset.fullSrcset || '';
    main.src = full;
    main.alt = thumb.dataset.fullAlt || '';
  });

  /* ========================
     Auto-submitting sort select (collection sort)
     The form works on its own with the noscript submit button; this just
     removes the extra click for everyone else. Filter checkboxes and the
     price range deliberately don't auto-submit — see the Filter Panel
     block below for why.
  ======================== */
  document.addEventListener('change', e => {
    const select = e.target.closest('[data-auto-submit] select');
    if (select) select.form?.submit();
  });

  /* ========================
     Filter Panel (collection filters)
     <details>/<summary> gives the "Filter" button its open/closed state and
     keyboard toggle for free, but a native <details> doesn't close itself
     on an outside click or Escape the way a dropdown is expected to — this
     adds just that, and only for a panel currently open.
  ======================== */
  document.addEventListener('click', e => {
    document.querySelectorAll('[data-filter-panel][open]').forEach(panel => {
      if (!panel.contains(e.target)) panel.removeAttribute('open');
    });
  });
  document.addEventListener('keydown', e => {
    if (e.key !== 'Escape') return;
    const openPanel = document.querySelector('[data-filter-panel][open]');
    if (!openPanel) return;
    openPanel.removeAttribute('open');
    openPanel.querySelector('summary')?.focus();
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
    mobileNav.querySelector('.mobile-nav__close')?.focus();
  }

  function closeMobileNav() {
    if (!mobileNav) return;
    /* Hand focus back to the hamburger before the panel is hidden, or it
       lands on <body> and the next Tab starts from the top of the page. */
    if (mobileNav.contains(document.activeElement)) mobileToggle?.focus();
    mobileNav.classList.remove('is-open');
    mobileNav.setAttribute('aria-hidden', 'true');
    mobileToggle?.setAttribute('aria-expanded', 'false');
    document.body.style.overflow = '';
  }

  mobileToggle?.addEventListener('click', openMobileNav);

  /* Without this, Tab walks out of the open drawer and into the page behind
     the scrim — links the user cannot see and cannot click. Links inside a
     collapsed submenu are display:none, so offsetParent filters them out and
     the cycle only covers what is actually on screen. */
  const DRAWER_FOCUSABLE = 'a[href], button:not([disabled]), input, select, textarea, [tabindex]:not([tabindex="-1"])';

  mobileNav?.addEventListener('keydown', e => {
    if (e.key !== 'Tab' || !mobileNav.classList.contains('is-open')) return;

    const items = Array.from(mobileNav.querySelectorAll(DRAWER_FOCUSABLE))
      .filter(el => el.offsetParent !== null);
    if (!items.length) return;

    const first = items[0];
    const last = items[items.length - 1];

    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });

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
  document.addEventListener('keydown', e => cartDrawer.trapFocus(e));

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
  fetch(ROUTES.cartJs)
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

    /* inert alongside aria-hidden: the bar is only pushed off-screen with a
       transform, so its Add to Cart button was reachable by Tab the whole way
       down the page — and aria-hidden over a focusable control is a
       contradiction screen readers resolve inconsistently. */
    const barObserver = new IntersectionObserver(([entry]) => {
      const show = !entry.isIntersecting;
      stickyBar.classList.toggle('is-visible', show);
      stickyBar.setAttribute('aria-hidden', String(!show));
      if (show) stickyBar.removeAttribute('inert');
      else stickyBar.setAttribute('inert', '');
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
     Hero Carousel
     Autoplay pauses on hover/focus/touch and never starts at all under
     prefers-reduced-motion — manual arrows, dots, and keyboard arrows still
     work either way. The section only renders controls once there's a
     second slide, so a one-slide hero never reaches this loop's slides.length
     check in a way that matters.
  ======================== */
  document.querySelectorAll('[data-carousel]').forEach(root => {
    const slides = [...root.querySelectorAll('[data-carousel-slide]')];
    if (slides.length < 2) return;

    const dots = [...root.querySelectorAll('[data-carousel-dot]')];
    const prevBtn = root.querySelector('[data-carousel-prev]');
    const nextBtn = root.querySelector('[data-carousel-next]');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    let current = 0;
    let timer = null;

    function show(index) {
      current = (index + slides.length) % slides.length;
      slides.forEach((slide, i) => {
        slide.hidden = i !== current;
        slide.classList.toggle('is-active', i === current);
      });
      dots.forEach((dot, i) => {
        dot.classList.toggle('is-active', i === current);
        dot.setAttribute('aria-selected', i === current ? 'true' : 'false');
      });
    }

    function stop() {
      if (timer) { clearInterval(timer); timer = null; }
    }

    function play() {
      if (reducedMotion || !root.hasAttribute('data-autoplay')) return;
      stop();
      timer = setInterval(() => show(current + 1), 6000);
    }

    prevBtn?.addEventListener('click', () => { show(current - 1); play(); });
    nextBtn?.addEventListener('click', () => { show(current + 1); play(); });
    dots.forEach((dot, i) => dot.addEventListener('click', () => { show(i); play(); }));

    root.addEventListener('mouseenter', stop);
    root.addEventListener('mouseleave', play);
    root.addEventListener('focusin', stop);
    root.addEventListener('focusout', play);

    /* A plain deltaX check on touchend, not a full drag-follow — this is a
       hero banner, not a photo gallery, so the slide doesn't need to track
       the finger mid-swipe. */
    let touchStartX = null;
    root.addEventListener('touchstart', e => {
      touchStartX = e.changedTouches[0].clientX;
      stop();
    }, { passive: true });
    root.addEventListener('touchend', e => {
      if (touchStartX === null) return;
      const deltaX = e.changedTouches[0].clientX - touchStartX;
      if (Math.abs(deltaX) > 50) show(deltaX < 0 ? current + 1 : current - 1);
      touchStartX = null;
      play();
    }, { passive: true });

    root.addEventListener('keydown', e => {
      if (e.key === 'ArrowLeft') { show(current - 1); play(); }
      else if (e.key === 'ArrowRight') { show(current + 1); play(); }
    });

    play();
  });

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
