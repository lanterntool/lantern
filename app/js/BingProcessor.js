const fs = require("fs");
const path = require("path");

class BingProcessor {
  bingParameters = "";
  formArray = "";
  formMap = "";

  data = [];
  constructor(filename) {
    if (filename === undefined) {
      this.bingParameters = "bingMap.json";
    } else {
      this.bingParameters = filename;
    }

    this.loadMap(this.bingParameters);
  }

  loadMap(mapFileToLoad) {
    try {
      const filePath = path.join(__dirname, "..", "maps", this.bingParameters);
      const data = fs.readFileSync(filePath, "utf8");
      this.formArray = JSON.parse(data);
      //console.log(this.formArray);
      this.formMap = new Map(this.formArray.map((item) => [item.Value, item.Meaning]));
    } catch (err) {
      console.error(err);
    }
  }

  dev = true;
  searchValue = "";
  //TODO refactor to read formMap and Regex from a config file
  parameterEndRegex = new RegExp("&|,");

  //TODO refactor to read this from a config file
  thidMap = new Map([
    [
      "OIP",
      `On [searchDate]  at [searchTime] URL parameter thid=OIP indicates the user clicked on a thumbnail image (image ID: [image_id]) visible in the results page for search "[searchString]" in order to view the full-size image within the browser.`,
    ],

    [
      "OIF",
      `On [searchDate]  at [searchTime] URL parameter thid=OIF indicates the user clicked on a thumbnail image (image ID: [image_id]) visible in the results page for search "[searchString]" in order to view the full-size image within the browser.In this case, the image was recently posted and indexed by Bing"," with a time frame indicated in the top left of the thumbnail.`,
    ],
  ]);

  printMap() {
    console.log(this.formMap);
  }

  processURL(url) {
    let urlInUpperCase = url.toUpperCase();
    let isFORMID = urlInUpperCase.includes("FORM=");
    let isTHID = urlInUpperCase.includes("THID=");
    let formID = null;
    let humanReadableFormId = null;

    if (this.dev) {
      console.log("isFORM ID " + isFORMID);
      console.log("isTHID " + isTHID);
    }

    if (isFORMID || isTHID) {
      //Parse the date
      let date = this.parseDate(url);

      //Parse the FORMID/THIDID
      if (isFORMID) {
        formID = this.parseFormID(url);
        console.log("The formID is..." + formID);
        humanReadableFormId = this.formMap.get(formID.trim());
        console.log("The humanReadableFormId is..." + humanReadableFormId);

        if (this.dev) {
          console.log("Found FORMID:" + formID);
        }
      } else if (isTHID) {
        formID = this.parseTHID(url);
        humanReadableFormId = this.thidMap.get(formID.trim());
      }

      //Parse the search string

      //Assuming initial search is always the previous value;
      //TODO bound this by Date and time
      let initialSearch = this.searchValue;

      let searchString = this.parseSearchString(url);
      this.searchValue = searchString;
      //console.log(`The searchValue is ${this.searchValue}`);
      //console.log(`The initialSearch is ${initialSearch}`);

      //Parse the image id
      let imageId = this.parseImageIdString(url);

      //Clean up the search strings (Remove "+" and "%20")
      let normalizedSearchString = this.cleanSearchValue(searchString);
      let normalizedInitialSearchString = this.cleanSearchValue(initialSearch);
      let month = date.getMonth() + 1; //getMonth() returns a 0 based month ¯\_(ツ)_/¯.
      let day = date.getDate();
      let year = date.getFullYear();
      let hours = date.getHours();
      let minutes = date.getMinutes();
      let seconds = date.getSeconds();
      let milliseconds = date.getMilliseconds();

      if (this.dev) {
        console.log("The date is: " + date);
        console.log("The form ID is: " + formID);
        console.log("The search string is : " + searchString);
        console.log("The normalized search string is : " + normalizedSearchString);
        console.log("The human readable form ID is " + humanReadableFormId);
        console.log("The Images ID is " + imageId);
      }

      //TODO do something with formID's we havent defined.
      if (humanReadableFormId != undefined) {
        //Pass over values we missed

        humanReadableFormId = humanReadableFormId
          .replace("[searchDate]", `${month}/${day}/${year}`)
          .replace("[searchTime]", `${hours}:${minutes}:${seconds}:${milliseconds}`)
          .replace("[searchString]", `${normalizedSearchString}`)
          .replace("[image_id]", `${imageId}`)
          .replace("[initialSearch]", `${normalizedInitialSearchString}`);
      }

      if (this.dev) {
        console.log("The final result is:  " + humanReadableFormId);
      }

      //Create a Javascript object containing the results.
      let BingQuery = {
        date: date,
        searchstring: normalizedSearchString,
        formid: formID,
        formvalue: humanReadableFormId,
        imageid: imageId,
      };

      return BingQuery;
    }
  }

  /**
   * Converts a string date in CSV file to a Javascript date object
   *
   * Assumes the first column in the CSV file is the date.
   * @param csvInput - A CSV string that contains the date in the first column
   * @return {Date} - A javascript Date object
   */
  parseDate(csvInput) {
    let rowSplit = csvInput.split(",");
    let date = rowSplit[0];
    let urlDate = new Date(date);
    return urlDate;
  }

  /**
   * Parses the the "FORM" parameters from a Bing image url
   *
   * @param URL - The URL to parse
   * @return {String} - The parsed value
   */
  parseFormID(url) {
    let start = url.toUpperCase().indexOf("FORM="); //TODO this assumes 'FORM=' only appears once in a BING URL Is that correct?

    //Test that we found the start of the FORMID
    if (url.substring(start + 4, start + 5) === "=") {
      let initialSubstring = url.slice(start + 5); //Pull out the everything after FORM=

      if (this.dev) {
        console.log("The initial FORMID substring is : " + initialSubstring);
      }
      let initialSubstringEnd = initialSubstring.search(this.parameterEndRegex); //Find the end of the FORM using a regex - formEndRegex
      let formID = initialSubstring.slice(0, initialSubstringEnd); //Slice the string from start to the end of the formEndRegex
      return formID;
    }

    return null; // A FORMID was not found
  }

  /**
   * Parses the "thid" parameters from a Bing image url
   *
   * @param URL - The URL to parse
   * @return {String} - The parsed value
   */
  parseTHID(url) {
    let start = url.toLowerCase().indexOf("thid="); //TODO this assumes 'thid=' only appears once in a BING URL Is that correct?

    //Test that we found the start of the FORMID
    if (url.substring(start + 4, start + 5) === "=") {
      //TODO this code assumes thidid is always only 3 charaters
      let thidID = url.slice(start + 5, start + 8); //Pull out the first three characters after thid=

      if (this.dev) {
        console.log("The initial thid substring is : " + thidID);
      }

      return thidID;
    }

    return null; // A THIDID was not found
  }

  /**
   * Parses the search string from a BING image url
   *
   * @param URL - The URL to parse
   * @return {String} - The parsed search value
   */
  parseSearchString(url) {
    let start = url.toLowerCase().indexOf("search?q=");
    console.log("The search starts at : " + url.substring(start, start + 9));

    //Test that we found the start of the search string
    if (url.substring(start + 8, start + 9) === "=") {
      let initialSubstring = url.slice(start + 9); //Pull out everything after search?q=
      console.log("The initial search substring is : " + initialSubstring);
      let initialSubstringEnd = initialSubstring.search(this.parameterEndRegex); //Find the end of the search parameter using a regex - parameterEndRegex
      let searchString = initialSubstring.slice(0, initialSubstringEnd); //Slice the string from start to the end of the parameterEndRegex
      return searchString;
    }
    return ""; // A search string was not found
  }

  /**
   * Parses the image id from a BING image url
   *
   * @param URL - The URL to parse
   * @return {String} - The parsed search value
   */
  parseImageIdString(url) {
    let start = url.toLowerCase().indexOf("&id=");
    console.log("The Image ID starts at : " + url.substring(start, start + 4));

    //Test that we found the start of the search string
    if (url.substring(start + 3, start + 4) === "=") {
      let initialSubstring = url.slice(start + 4); //Pull out everything after &id=
      console.log("The initial search substring is : " + initialSubstring);
      let initialSubstringEnd = initialSubstring.search(this.parameterEndRegex); //Find the end of the  parameter using a regex - parameterEndRegex
      let imageIdString = initialSubstring.slice(0, initialSubstringEnd); //Slice the string from start to the end of the parameterEndRegex
      return imageIdString;
    }
    return ""; // A imageid was not found
  }

  /**
   * Removes "+" and "%20" from a string
   *
   * @param inputString - The search string to modify
   * @return {String} - The cleaned string
   */
  cleanSearchValue(inputString) {
    return inputString.replace(/\+/g, " ").replace(/%20/g, " ");
  }
}
module.exports = BingProcessor;
