/* format.js — Swedish formatting + turning a Blocket doc into a table row. */
(() => {
  'use strict';

  const nf = new Intl.NumberFormat('sv-SE');

  const num = (n) => (typeof n === 'number' && isFinite(n) ? nf.format(n) : '');

  const price = (p) => {
    if (!p || typeof p.amount !== 'number') return '';
    return nf.format(p.amount) + ' kr';
  };

  /* Blocket stores mileage in Swedish "mil" (1 mil = 10 km). */
  const mil = (m) => (typeof m === 'number' ? nf.format(m) : '');

  const AGE_UNITS = [
    [60 * 1000, 'nu'],
    [60 * 60 * 1000, (d) => Math.round(d / 60000) + ' min'],
    [24 * 60 * 60 * 1000, (d) => Math.round(d / 3600000) + ' tim'],
    [30 * 24 * 60 * 60 * 1000, (d) => Math.round(d / 86400000) + ' d'],
    [365 * 24 * 60 * 60 * 1000, (d) => Math.round(d / (30 * 86400000)) + ' mån'],
  ];

  const age = (ts) => {
    if (!ts) return '';
    const d = Date.now() - ts;
    if (d < 0) return 'nu';
    for (const [limit, label] of AGE_UNITS) {
      if (d < limit) return typeof label === 'function' ? label(d) : label;
    }
    return Math.round(d / (365 * 86400000)) + ' år';
  };

  /* Short gearbox / fuel labels — the full ones eat too much width. */
  const SHORT_TRANSMISSION = { Automatisk: 'Aut', Manuell: 'Man' };
  const SHORT_FUEL = {
    Bensin: 'Bensin',
    Diesel: 'Diesel',
    El: 'El',
    'Etanol (FFV, E85)': 'E85',
    'Fordonsgas (CNG)': 'Gas',
    'Hybrid bensin': 'Hybrid B',
    'Hybrid diesel': 'Hybrid D',
    'Hybrid gas': 'Hybrid G',
    'Plug-in Bensin': 'Laddhybrid B',
    'Plug-in Diesel': 'Laddhybrid D',
  };

  /* Blocket's image CDN encodes the width as a path segment: .../dynamic/480w/item/...
     Valid widths include 240w, 320w and 480w — 180w 404s. Asking for 240w instead of
     the full-size "default" keeps a 50-row page to a few hundred KB of images. */
  const thumb = (doc, size) => {
    const url = (doc.image && doc.image.url) || (doc.image_urls && doc.image_urls[0]) || '';
    if (!url) return '';
    return url.replace(/\/dynamic\/[^/]+\/item\//, '/dynamic/' + (size || '240w') + '/item/');
  };

  const toRow = (doc) => {
    const year = typeof doc.year === 'number' ? doc.year : null;
    const mileage = typeof doc.mileage === 'number' ? doc.mileage : null;
    const carAge = year ? Math.max(1, new Date().getFullYear() - year) : null;

    return {
      id: String(doc.ad_id != null ? doc.ad_id : doc.id || ''),
      url: doc.canonical_url || ('https://www.blocket.se/mobility/item/' + doc.ad_id),
      make: doc.make || '',
      model: doc.model || '',
      title: doc.heading || doc.facade_title || [doc.make, doc.model].filter(Boolean).join(' '),
      spec: doc.model_specification || '',
      year,
      mileage,
      /* mil per year — the number that actually tells you if a car is worn */
      milPerYear: mileage != null && carAge ? Math.round(mileage / carAge) : null,
      fuel: doc.fuel || '',
      fuelShort: SHORT_FUEL[doc.fuel] || doc.fuel || '',
      transmission: doc.transmission || '',
      transmissionShort: SHORT_TRANSMISSION[doc.transmission] || doc.transmission || '',
      priceAmount: doc.price && typeof doc.price.amount === 'number' ? doc.price.amount : null,
      priceText: price(doc.price),
      location: doc.location || '',
      seller: doc.organisation_name || (doc.dealer_segment === 'Privat' ? 'Privat' : doc.dealer_segment || ''),
      isDealer: doc.dealer_segment && doc.dealer_segment !== 'Privat',
      timestamp: doc.timestamp || null,
      regno: doc.regno || '',
      image: thumb(doc, '240w'),
      imageCount: Array.isArray(doc.image_urls) ? doc.image_urls.length : 0,
      hasService: Array.isArray(doc.service_documents) && doc.service_documents.length > 0,
    };
  };

  window.BCFormat = { num, price, mil, age, toRow };
})();
