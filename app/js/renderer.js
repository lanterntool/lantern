console.log("renderer.js");
const path = require("path");
const os = require("os");
const homedir = path.join(os.homedir());
const { dialog, nativeImage } = require("electron").remote;
const { ipcRenderer } = require("electron");
const { remote } = require("electron");
let outputPath = document.getElementById("output-dir");
let outputFile;
let inputFile;
let mainWindow = remote.getCurrentWindow();

const form = document.getElementById("process-form");
const inputFileFileField = document.getElementById("inputFileField");
const outputFileField = document.getElementById("outputFileField");
const inputBtn = document.getElementById("inputBtn");
const outputBtn = document.getElementById("outputBtn");
const submitBtn = document.getElementById("submitBtn");

//User clicked on input button
inputBtn.addEventListener("click", () => {
  dialog
    .showOpenDialog({
      title: "Open",
      defaultPath: homedir,
      properties: ["openFile"],
      filters: [
        { name: "csv", extensions: ["csv"] },
        { name: "All Files", extensions: ["*"] },
      ],
    })
    .then((result) => {
      //console.log(result.canceled);
      if (!result.canceled) {
        //console.log(result.filePaths[0]);
        inputFile = result.filePaths[0];
        inputFileFileField.placeholder = inputFile;
        outputBtn.classList.remove("disabled");
      } else {
        inputFile = "";
        inputFileFileField.placeholder = "File to process";
        if (!outputBtn.classList.contains("disabled")) {
          outputBtn.classList.add("disabled");
        }
        if (!submitBtn.classList.contains("disabled")) {
          submitBtn.classList.add("disabled");
        }
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

//User clicked output button
outputBtn.addEventListener("click", () => {
  dialog
    .showSaveDialog({
      properties: ["createDirectory"],
    })
    .then((result) => {
      if (!result.canceled) {
        outputFile = result.filePath;

        if (!outputFile.endsWith(".csv")) {
          outputFile = outputFile + ".csv";
        }

        outputFileField.placeholder = outputFile;
        submitBtn.classList.remove("disabled");
      } else {
        outputFile = "";
        outputFileField.placeholder = "Output file";
        if (!outputBtn.classList.contains("disabled")) {
          submitBtn.classList.add("disabled");
        }
      }
    })
    .catch((err) => {
      console.log(err);
    });
});

//User clicked submit button
form.addEventListener("submit", (ev) => {
  ev.preventDefault();
  submitBtn.value = "Running";

  //Disable all the buttons while processing the file
  if (!submitBtn.classList.contains("disabled")) {
    submitBtn.classList.add("disabled");
  }
  if (!outputBtn.classList.contains("disabled")) {
    outputBtn.classList.add("disabled");
  }
  if (!inputBtn.classList.contains("disabled")) {
    inputBtn.classList.add("disabled");
  }

  // console.log(inputFile);
  // console.log(outputFile);

  //Send the inputfile and outputfile to main.js for processing.
  ipcRenderer.send("processFile", {
    inputFile,
    outputFile,
  });
});

//Listen for processing complete from the main process
ipcRenderer.on("processing-complete", (event, arg) => {
  //reset buttons to allow the user to process another file/
  resetFields();
});

//Resets the app field to what they are on first run.
function resetFields() {
  submitBtn.value = "Process";
  inputBtn.classList.remove("disabled");
  inputFileFileField.placeholder = "File to process";
  outputFileField.placeholder = "Output file";
}
