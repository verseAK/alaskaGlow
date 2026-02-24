// Template-based aurora summary generator
// No LLM calls — zero marginal cost, predictable output

function cloudPhrase(cloudCover) {
  if (cloudCover === null) return 'cloud data unavailable';
  if (cloudCover <= 15) return 'skies are mostly clear';
  if (cloudCover <= 40) return 'partly cloudy skies';
  if (cloudCover <= 70) return 'mostly cloudy conditions';
  return 'overcast skies';
}

function moonPhrase(moonData) {
  if (!moonData) return '';
  if (!moonData.isUp) return 'the moon is below the horizon';
  if (moonData.illumination <= 15) return 'a thin crescent moon won\'t interfere';
  if (moonData.illumination <= 40) return `the ${moonData.phaseName.toLowerCase()} adds some brightness`;
  if (moonData.illumination <= 70) return `the bright ${moonData.phaseName.toLowerCase()} may wash out fainter displays`;
  return `the bright ${moonData.phaseName.toLowerCase()} will wash out fainter displays`;
}

function kpPhrase(kp, threshold, locationName) {
  const diff = kp - threshold;
  if (diff >= 3) return `Kp ${kp.toFixed(1)} is far above ${locationName}'s threshold of ${threshold}`;
  if (diff >= 1) return `Kp ${kp.toFixed(1)} is well above ${locationName}'s threshold of ${threshold}`;
  if (diff >= 0) return `Kp ${kp.toFixed(1)} is at ${locationName}'s visibility threshold of ${threshold}`;
  return `Kp ${kp.toFixed(1)} is below ${locationName}'s threshold of ${threshold}`;
}

export function generateSummary({
  locationName,
  rating,
  currentKp,
  kpVisible,
  kpGood,
  cloudCoverNow,
  cloudCoverMin6h,
  moonData,
  isDark,
  bz,
}) {
  const kpStr = kpPhrase(currentKp, kpVisible, locationName);
  const cloudStr = cloudPhrase(cloudCoverMin6h ?? cloudCoverNow);
  const moonStr = moonPhrase(moonData);

  switch (rating) {
    case 'great':
      return `Excellent conditions tonight. ${kpStr}, ${cloudStr}${moonStr ? ', and ' + moonStr : ''}.`;

    case 'possible': {
      const factors = [];
      if (currentKp < kpGood) factors.push(`Kp is moderate at ${currentKp.toFixed(1)}`);
      if (cloudCoverNow > 40) factors.push('partial cloud cover expected');
      if (moonData?.isUp && moonData.illumination > 40) factors.push(`the ${moonData.phaseName.toLowerCase()} adds brightness`);
      const reason = factors.length > 0 ? factors.join(', ') : 'conditions are marginal';
      return `Moderate chance tonight — ${reason}. Keep an eye on conditions as they can improve quickly.`;
    }

    case 'active_but_cloudy':
      return `The aurora is active (${kpStr}) but ${cloudStr}. Watch for breaks in the clouds — conditions can change fast in Alaska.`;

    case 'unlikely': {
      if (!isDark) return 'Not dark enough for aurora viewing right now. Check back after sunset.';
      if (currentKp < kpVisible) return `Geomagnetic activity is low (Kp ${currentKp.toFixed(1)}). ${locationName} typically needs Kp ${kpVisible}+ for visible aurora.`;
      return `Conditions aren't favorable right now — ${cloudStr} and ${kpStr}. Check back later tonight.`;
    }

    default:
      return `Current Kp is ${currentKp.toFixed(1)}. ${locationName} needs Kp ${kpVisible}+ for aurora visibility.`;
  }
}
