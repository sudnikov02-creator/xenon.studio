import express from 'express';
import { getSettings } from '../db.js';

const router = express.Router();

router.get('/branding', (req, res) => {
  const settings = getSettings();
  res.json({
    branding: {
      siteName: settings.siteName,
      photographerName: settings.photographerName,
      brandTagline: settings.brandTagline,
      accentColor: settings.accentColor,
      logoUrl: settings.logoUrl,
      faviconUrl: settings.faviconUrl,
      timezone: settings.timezone,
      currencySymbol: settings.currencySymbol,
      currencyCode: settings.currencyCode,
      decimalSeparator: settings.decimalSeparator,
      locale: settings.locale,
      landingEnabled: settings.landingEnabled,
      seo: settings.seo
    }
  });
});

export default router;
