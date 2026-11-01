import express from 'express';
import { getSettings } from '../db.js';
import { listPackages, listServices } from '../lib/services.js';

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
      contacts: settings.contacts || { phone: '', telegram: '', instagram: '', email: '' },
      landingEnabled: settings.landingEnabled,
      seo: settings.seo
    }
  });
});

router.get('/services', (req, res) => {
  const services = listServices()
    .filter((service) => service.isActive)
    .map(({ id, name, description, price, duration, buffer, addons }) => ({
      id,
      name,
      description,
      price,
      duration,
      buffer,
      addons
    }));
  const packages = listPackages()
    .filter((item) => item.isActive)
    .map(({ id, name, description, price, serviceIds, addons }) => ({
      id,
      name,
      description,
      price,
      serviceIds,
      addons
    }));
  res.json({ services, packages });
});

export default router;
