const path = require("path");
const os = require("os");
const fs = require("fs");
const readline = require("readline");
const { app, BrowserWindow, Menu, globalShortcut, ipcMain, dialog, shell } = require("electron");
const bingRegex = new RegExp("bing.com/images/", "i");
const BingProcessor = require("./app/js/BingProcessor.js");

//  Debug - Production switch
//process.env.NODE_ENV = 'development';
process.env.NODE_ENV = "production";

const isDev = process.env.NODE_ENV !== "production" ? true : false;
const isMac = process.platform === "darwin" ? true : false;

let mainWindow;
let aboutWindow;

function createMainWindow() {
  mainWindow = new BrowserWindow({
    show: false, //Hide the window until the DOM is ready
    title: "Lantern",
    width: isDev ? 1024 : 500,
    height: 600,
    icon: `{__dirname}./assets/icons/Icon_256x256.png`,
    resizable: isDev ? true : false,
    backgroundColor: "white",
    webPreferences: {
      nodeIntegration: true,
    },
  });

  mainWindow.loadFile("./app/index.html");

  if (isDev) {
    mainWindow.webContents.openDevTools();
  }

  //Show the Window once tbe DOM is ready
  mainWindow.once("ready-to-show", () => {
    mainWindow.show();
  });
}

function creatAboutWindow() {
  aboutWindow = new BrowserWindow({
    show: false,
    title: "About Lantern",
    width: 1024,
    height: 768,
    icon: `{__dirname}./assets/icons/icon.png`,
    resizable: false,
    backgroundColor: "white",
  });

  aboutWindow.loadFile("./app/about.html");
  aboutWindow.setMenu(null);
  aboutWindow.once("ready-to-show", () => {
    aboutWindow.show();
  });
}

function creatFinishedWindow() {
  finishedWindow = new BrowserWindow({
    show: false,
    title: "Processing complete",
    width: 300,
    height: 300,
    icon: `{__dirname}./assets/icons/icon.png`,
    resizable: false,
    backgroundColor: "white",
  });

  finishedWindow.loadFile("./app/finished.html");

  finishedWindow.once("ready-to-show", () => {
    aboutWindow.show();
  });
}

app.on("ready", () => {
  createMainWindow();
  const mainMenu = Menu.buildFromTemplate(menu);
  Menu.setApplicationMenu(mainMenu);
  globalShortcut.register("CmdOrCtrl+R", () => mainWindow.reload());
  globalShortcut.register(isMac ? "Command+Alt+I" : "Ctrl+Shift+I", () => mainWindow.toggleDevTools());
  mainWindow.on("closed", () => (mainWindow = null));
});

const menu = [
  ...(isMac
    ? [
        {
          label: app.name,
          submenu: [
            {
              label: "About",
              click: creatAboutWindow,
            },
            {
              label: "Quit",
              accelerator: "CmdOrCtrl+W",
              click: () => app.quit(),
            },
          ],
        },
      ]
    : []),
  {
    role: "fileMenu",
  },
  ...(!isMac
    ? [
        {
          label: "Help",
          submenu: [
            {
              label: "About",
              click: creatAboutWindow,
            },
          ],
        },
      ]
    : []),
  ...(isDev
    ? [
        {
          label: "Developer",
          submenu: [{ role: "reload" }, { role: "forcereload" }, { type: "separator" }, { role: "toggledevtools" }],
        },
      ]
    : []),
];

//Processes a CSV file line by line.
ipcMain.on("processFile", (event, options) => {
  let results = [];
  let bingProcessor = new BingProcessor();
  if (isDev) {
    console.log(options);
    console.log(options.inputFile);
  }

  //https://nodejs.org/api/readline.html
  const rl = readline.createInterface({
    input: fs.createReadStream(options.inputFile),
    output: process.stdout,
    terminal: false, //Speed up switch
  });

  //For each csv line
  rl.on("line", (line) => {
    if (bingRegex.test(line)) {
      // We found a bing.com url using our regex
      result = bingProcessor.processURL(line); // Process the line with BingProcessor.js
      if (result) {
        results.push(result); // Add the processed line to the results array
      }
    }
  });

  //We are done reading the file.
  rl.on("close", () => {
    console.log("Reached EOF");

    //Write the results to CSV
    let outputCsv = "Date,Search String, FormID, Form Meaning\n";
    results.forEach((logentry) => {
      outputCsv += logentry.date + ",";
      outputCsv += logentry.searchstring + ",";
      outputCsv += logentry.formid + ",";
      outputCsv += logentry.formvalue + ",";
      outputCsv += "\n";
    });

    //TODO handle errors
    //Write the file to disk
    fs.writeFile(options.outputFile, outputCsv, function (err) {
      if (err) return console.log(err);

      console.log("File " + options.outputFile + " written");
    });

    //Popup message box showing that processing is complete.
    dialog
      .showMessageBox({
        //https://www.electronjs.org/docs/api/dialog
        type: "question",
        //title: "Finished",
        message: "Processing complete",
        detail: "Would you like to open the file?",
        buttons: ["Yes", "No"],
        icon: `{__dirname}./assets/icons/icon.png`, //TODO still shows electron icon on Mac
      })
      .then((result) => {
        //showMessageBox returns a JS promise object with index of the clicked button.

        if (isDev) {
          console.log(`Promised returned: ${result.response}`);
        }

        //Open the file with default editor if the user clicked yes.
        if (result.response === 0) {
          shell.openItem(options.outputFile);
        }
      });

    //Notify render process that processing is complete so it can reset the fields.
    //https://www.electronjs.org/docs/api/ipc-main
    event.reply("processing-complete", "pong");
  });
});

app.allowRendererProcessReuse = true;
