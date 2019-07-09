// import * from './Analytics.js';
// import {SelectorTracking} from './Helpers.js';
// import {GetParams} from './Helpers.js';
// import {CheckAnchorQueries} from './Helpers.js';
// import {SearchElementForSelector} from './Helpers.js';
// import {CalcEventNameForElement} from './Helpers.js';
// import {CalcEventNameMap} from './Helpers.js';
import { Warn } from './Utils.js';
import { Analytics } from './Analytics2.js';


const puppeteer = require("puppeteer");
const chalk = require ("chalk");

//colors for console logs
const error = chalk.bold.red;
const success = chalk.keyword("green");

const username = 'test';
const password = 'test';

const readline = require('readline');
const rl = readline.createInterface({
  input: process.stdin,
  output: process.stdout
});


rl.question(`Enter  URL: `, (url) => {
  console.log(`Firing Analytics for ${url}!`);
  console.log(`
   ||  ||
   \\\\()//
  //(__)\\\\
  ||    ||
  `);

  (async () => {
      try {
          var browser = await puppeteer.launch({
            headless: false,
            defaultViewport: null,
            devtools: true
          });
          var page = await browser.newPage();
          // page.on('console', msg => console.log('PAGE LOG:', msg.text()));


// TODO: find out how to append username and password into url????

          var jsonUrl = url;
          if(url.includes("search"))
          {
            jsonUrl = jsonUrl + "?xYextForceJson=true";
          }
          else if(url.endsWith(".com"))
          {
            jsonUrl = jsonUrl + "/index.json";
          }
          else if(url.endsWith(".com/"))
          {
            jsonUrl = jsonUrl + "index.json";
          }
          else if(url.endsWith(".ca"))
          {
            jsonUrl = jsonUrl + "/index.json";
          }
          else if(url.endsWith(".ca/"))
          {
            jsonUrl = jsonUrl + "index.json";
          }
          else if(url.endsWith(".html"))
          {
            jsonUrl = jsonUrl.substring(0, jsonUrl.length-5) + ".json";
          }
          else {
            jsonUrl = jsonUrl + ".json";
          }

//TODO: add logic to append .json to end of url
// for root page, add /index.json
//for search: ?xYextForceJson=true

//sitemap.xml to see which pages

          await page.goto(`${jsonUrl}`);
          var content = await page.content();
          var jsonData = await page.evaluate(() => {
            var allData = JSON.parse(document.querySelector("body").innerText);
            var busId = allData['businessId'];
            var jsonData = {};
            jsonData['businessids'] = allData['businessId'];
            jsonData['siteId'] = allData['siteId'];
            var template = allData['soyTemplateName'];
            if (template.includes('search')){
              jsonData['searchId'] = allData['searchId'];
            }
            if (template.includes('directory')){
              var crumbs = allData['crumbNames'];
              var path = "";
              for (var i=1; i < crumbs.length; i++){
                if(i!=1)
                {
                  path.concat("/");
                }
                path.concat(crumbs[i]);
              }
              jsonData['directoryPath'] = path;
              jsonData['directoryId'] = allData['directoryId'];
            }
            if (template.includes('locationEntity')){
              jsonData['pageSetId'] = allData['entitypagesetId'];
              jsonData['ids'] = allData['profile']['meta']['yextId'];
            }
            return jsonData;
          });
          //
          // await page.setViewport({
          //     width: 100,
          //     height: 100
          // });

          await page.goto(`${url}`);



          await page.exposeFunction('CalcEventNameForElement', (name, referrer, url) => {
            let type = null;
            let trackDetails = null;
            let srcEl = null;
            var data = {};
            Object.assign(data, jsonData);
            data['pagesReferrer'] = referrer;
            data['pageurl'] = url;
            var url = Analytics.trackEvent(name, data);
            return url;
          });

          await page.evaluate(async () => {

            let names = [];

            var pagesReferrer = window.document.referrer;
            var pageurl = window.location.pathname;

            function SearchElementForSelector(el, s) {
              while (el && (el.tagName && !el.matches(s))) {
                el = el.parentNode;
              }

              if (el && el.tagName && el.matches(s)) {
                return el;
              }
              return null;
            }

            function GetParams(url) {
              let queries = {};
              let parts = url.split('?');
              if (parts.length == 2) {
                parts[1].split('&').forEach((pair)=>{
                  let params = pair.split('=');
                  queries[params[0]] = params[1];
                });
              }
              return queries;
            }
            function CheckAnchorQueries(anchor) {
              if (anchor && anchor.href) {
                // console.log("askdjfasd");
                // console.log(anchor);
                // console.log(anchor.href);
                let eName = GetParams(anchor.href)['ya-track'];
                if (eName) {
                  return eName;
                }
              }
              return false;
            }
            let SelectorTracking = {};

            var events = document.querySelectorAll('button, a, input');

            events.forEach(function(element){
              try {
                let type = null;
                let trackDetails = null;
                let srcEl = null;

                for (const selector in SelectorTracking) {
                  if (!element.matches(selector)) continue;
                  trackDetails = SelectorTracking[selector];
                }

                if (!trackDetails) {
                  let potentialYaTrackedEl = SearchElementForSelector(element, '[data-ya-track]');
                  if (potentialYaTrackedEl) {
                    srcEl = potentialYaTrackedEl;
                    trackDetails = (potentialYaTrackedEl.dataset ? potentialYaTrackedEl.dataset.yaTrack : potentialYaTrackedEl.getAttribute('data-ya-track'));
                  }
                }

                let preventDefaultEvent = SearchElementForSelector(element, '[data-ya-prevent-default]');

                if (!preventDefaultEvent && !trackDetails) {
                  let anchor = SearchElementForSelector(element, 'a');
                  if (anchor) {
                    srcEl = anchor;
                    let anchorQuery = CheckAnchorQueries(anchor);
                    if (anchorQuery) trackDetails = anchorQuery;
                    if (!anchorQuery && !trackDetails) {
                      type = 'link';
                    }
                  }
                }

                if (!preventDefaultEvent && !trackDetails && !type) {
                  let button = SearchElementForSelector(element, 'button');
                  if (button) {
                    srcEl = button;
                    type = 'button';
                  }
                }

                if (!preventDefaultEvent && !trackDetails && !type) {
                  let input = SearchElementForSelector(element, 'input');
                  if (input && input.type != 'hidden') {
                    srcEl = input;
                    type = 'input';
                  }
                }

                let dataYaTrack = type || trackDetails;
                let name = null;

                if(dataYaTrack)
                {
                  let scopeAncestors = [];
                  while (element && element.tagName) {
                    if (element.matches('[data-ya-scope]')) {
                      scopeAncestors.push(element);
                    }
                    element = element.parentNode;
                  }

                  let tags = [srcEl].concat(scopeAncestors);
                    for (const [hierarchyIdx, hierarchyElement] of tags.entries()) {
                      let tagVal = (hierarchyIdx == 0) ? dataYaTrack : (hierarchyElement.dataset ? hierarchyElement.dataset.yaScope : hierarchyElement.getAttribute('data-ya-scope'))
                      if (tagVal.indexOf('#') > -1) {
                        let attributeName = hierarchyIdx == 0 ? 'data-ya-track': 'data-ya-scope';
                        let ancestor = (hierarchyIdx + 1 < tags.length) ? tags[hierarchyIdx + 1]: document;
                        let siblings = Array.from(ancestor.querySelectorAll(`[${attributeName}='${tagVal}']`));
                        for (const [siblingIdx, sibling] of siblings.entries()) {
                          if (hierarchyElement == sibling) {
                            tagVal = tagVal.replace('#', siblingIdx + 1);
                            break;
                          }
                        }
                      }
                      tags[hierarchyIdx] = tagVal;
                    }
                    let name = tags.reverse().join('_');
                    names.push(name);
                }
              } catch (err){
                console.log(err);
              }
              });
              names.forEach(function(name){
                var url = window.CalcEventNameForElement(name, pagesReferrer, pageurl);
                url.then(data => {
                  const px = document.createElement("img");
                  px.src = data;
                  px.style.width = '0';
                  px.style.height = '0';
                  px.style.position = 'absolute';
                  px.alt = '';
                  document.body.appendChild(px);
                  return px;
                });
              });

          });
          await page.waitFor(100000);
          await browser.close();
          console.log(success("Browser Closed"));
      } catch (err) {
          console.log(err);
          await browser.close();
          console.log(error("Browser Closed"));
      }
  })();
  rl.close()
});
