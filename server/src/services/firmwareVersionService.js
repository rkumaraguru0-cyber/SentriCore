const FirmwareRelease = require("../models/FirmwareRelease");

const compareVersions = (currentVersion, latestVersion) => {
  const current = currentVersion
    .split(".")
    .map(Number);

  const latest = latestVersion
    .split(".")
    .map(Number);

  for (
    let i = 0;
    i < Math.max(current.length, latest.length);
    i++
  ) {
    const currentPart = current[i] || 0;
    const latestPart = latest[i] || 0;

    if (latestPart > currentPart) {
      return true;
    }

    if (latestPart < currentPart) {
      return false;
    }
  }

  return false;
};

const getLatestFirmwareRelease = async () => {
  const releases = await FirmwareRelease.find({
    status: "available",
  }).sort({
    releasedAt: -1,
  });

  if (releases.length === 0) {
    return null;
  }

  let latestRelease = releases[0];

  for (const release of releases) {
    if (
      compareVersions(
        latestRelease.version,
        release.version
      )
    ) {
      latestRelease = release;
    }
  }

  return latestRelease;
};

const checkFirmwareUpdate = async (
  currentVersion
) => {
  const latestRelease =
    await getLatestFirmwareRelease();

  if (!latestRelease) {
    return {
      updateAvailable: false,
      currentVersion,
      latestVersion: null,
      release: null,
    };
  }

  const updateAvailable = compareVersions(
    currentVersion,
    latestRelease.version
  );

  return {
    updateAvailable,
    currentVersion,
    latestVersion: latestRelease.version,
    release: latestRelease,
  };
};

module.exports = {
  compareVersions,
  getLatestFirmwareRelease,
  checkFirmwareUpdate,
};