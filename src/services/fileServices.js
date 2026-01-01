const fs = require("fs");
const path = require("path");
const dayjs = require("dayjs");
const { months, mediaTypes, jsonKeys } = require("./constants.js");
const { updateExifData } = require("./exif");

const isDebugging = process.env.DEBUG_MODE;
let outputDirectory;

const getMemoryDataFromJSON = (inputFile) =>
  JSON.parse(fs.readFileSync(inputFile));

const initializeEnvironment = (file, output) => {
  if (!fs.existsSync(file)) throw new Error(`JSON file "${file}" not found.`);

  outputDirectory = output;
  if (!fs.existsSync(outputDirectory)) fs.mkdirSync(outputDirectory);
};

const getFileName = async (memory, isConcatenatedVideo = false) => {
  const isPhoto = memory[jsonKeys.MEDIA_TYPE] === mediaTypes.IMAGE;
  const extension = isPhoto ? "jpg" : "mp4";
  const memoryDate = dayjs(memory[jsonKeys.DATE]);
  const year = memoryDate.format("YYYY");
  const month = months[memoryDate.format("MM")];
  const day = memoryDate.format("DD");
  let fileName;

  if (!fs.existsSync(outputDirectory))
    throw new Error(`Output directory "${outputDirectory}" does not exist`);

  const parentDirectory = path.normalize(path.join(outputDirectory, year));

  if (!fs.existsSync(parentDirectory)) {
    fs.mkdirSync(parentDirectory);
  }

  fileName = `${month}-${day}${isPhoto || isConcatenatedVideo ? "" : "-short"}`;

  let i = 1;
  let confirmedFileName = fileName;
  while (
    fs.existsSync(
      path.normalize(
        path.join(parentDirectory, `${confirmedFileName}.${extension}`)
      )
    )
  ) {
    confirmedFileName = `${fileName}-${i++}`;
  }

  return path.normalize(
    path.join(parentDirectory, `${confirmedFileName}.${extension}`)
  );
};

const writeFile = async (file, data) => {
  const fileStream = fs.createWriteStream(file);

  await new Promise((resolve, reject) => {
    data.pipe(fileStream);
    data.on("error", reject);
    fileStream.on("finish", resolve);
  }).catch((err) => {
    if (isDebugging)
      console.log(
        `An error occurred with the file system. Error: ${err.message}`
      );
  });
};

const updateFileMetadata = (file, memory) => {
  const date = dayjs(memory[jsonKeys.DATE]).toDate();
  fs.utimes(file, date, date, () => {});

  const locationParts = memory[jsonKeys.LOCATION]?.split(": ");
  if (!locationParts || locationParts.length < 2) {
    return;
  }

  const geolocationString = locationParts[1];
  const [latitude, longitude] = geolocationString.split(", ");
  const geolocationData = {
    latitude: parseFloat(latitude),
    longitude: parseFloat(longitude),
  };

  return updateExifData(file, memory[jsonKeys.DATE], geolocationData);
};

const getOutputInfo = () => {
  if (isDebugging) console.log("Getting output info");

  return {
    outputDirectory,
    message: `Your memories have been downloaded at:<br /><tt>${outputDirectory}</tt>`,
  };
};

module.exports = {
  initializeEnvironment,
  getMemoryDataFromJSON,
  getFileName,
  writeFile,
  updateFileMetadata,
  getOutputInfo,
};
