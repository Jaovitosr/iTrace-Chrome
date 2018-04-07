// main JavaScript driver for the iTrace-Chrome plugin, all data will be handled here

/**
 * Get the current URL.
 *
 * @param {function(string)} callback called when the URL of the current tab
 *   is found.
 */
function getCurrentTabUrl(callback) {
  // Query filter to be passed to chrome.tabs.query - see
  // https://developer.chrome.com/extensions/tabs#method-query
  var queryInfo = {
    active: true,
    currentWindow: true
  };

  chrome.tabs.query(queryInfo, (tabs) => {
    var tab = tabs[0];

    var url = tab.url;

    console.assert(typeof url == 'string', 'tab.url should be a string');

    callback(url, tab.id);
  });
}

function translateCoordinates(x, y) {
    // broswer viewport dimensions

    // screen dimensions
    var screenX = screen.height;
    var screenY = screen.width;

    var offsetX = screenX - this.browserX;
    var offsetY = screenY - this.browserY;

    if (x < offsetX || y < offsetY) {
        // user is looking outside of the broswer viewport, most likely at the broswer's shell
        return null;
    } else {
        // user is looking in the broswer viewport, return the translated coordinates
        return { x: x - offsetX, y: y - offsetY };
    }
}

function getSOElementResult(stringElements) {
    var parser = new DOMParser();
    var elements = parser.parseFromString(stringElements, 'text/html');
    var elements = elements.getElementsByTagName('body');

    for (element of elements) {
        if (element.tagName == 'CODE') {
            if (this.questionElement.Body.contains(element)) {
                // question code
                console.log('question code');
                return 'question code';
            }
            for (answer in this.Body.answerElements) {
                if (answer.contains(element)) {
                    // answer code
                    console.log('answer code');
                    return 'answer code';
                }
            }
        }

        if (element.tagName == 'IMG') {
            if (this.questionElement.Body.contains(element)) {
                // question code
                console.log('question image');
                return 'question image';
            }
            for (answer in this.Body.answerElements) {
                if (answer.contains(element)) {
                    // answer code
                    console.log('answer image');
                    return 'answer image';
                }
            }
        }

        if (element.classList.contains('post-text')) {
            if (this.questionElement.Body.contains(element)) {
                // question code
                console.log('question text');
                return 'question text';
            }
            for (answer in this.Body.answerElements) {
                if (answer.contains(element)) {
                    // answer code
                    console.log('answer text');
                    return 'answer text';
                }
            }
        }

        if (element.classList.contains('post-tag')) {
            console.log('question-tag');
            return 'question tag';
        }

        if (element.classList.contains('vote')) {
            if (this.questionElement.Body.contains(element)) {
                // question code
                console.log('question vote');
                return 'question vote';
            }
            for (answer in this.Body.answerElements) {
                if (answer.contains(element)) {
                    // answer code
                    console.log('answer vote');
                    return 'answer vote';
                }
            }
        }

        if (element.Id == 'question-header') {
            console.log('question-title');
            return 'question-title';
        }
    }
}

function getBZElementResult(elements) {
    for (element of elements) {
       if (element.classList.contains('bz_show_bug_column')) {
           console.log('question info - 1');
       }

       if (element.classList.contains('bz_alias_short_desc_container')) {
           console.log('question title');
       }

       if (element.classList.contains('bz_comment_text')) {
           console.log('answer info');
       }

       if (element.classList.contains('bz_attach_extra_info')) {
           console.log('attachment info');
       }
   }
}

function receiveQuestion(questionElement) {
    var parser = new DOMParser();
    this.jQuestionElement = $.parseHTML(questionElement);
    this.questionElement = parser.parseFromString(questionElement, 'text/html');
    this.questionElement = this.questionElement.getElementsByTagName('body');

    console.log(this.jQuestionElement);
    console.log(this.questionElement);
}

function receiveAnswers(answerElements) {
    var parser = new DOMParser();
    this.jAnswerElements = $.parseHTML(answerElements);
    this.answerElements = parser.parseFromString(answerElements, 'text/html');
    this.answerElements = this.answerElements.getElementsByTagName('body');

    console.log(this.jAnswerElements);
    console.log(this.answerElements);
}

// establish the websocket connection
chrome.browserAction.onClicked.addListener(function (tab) {
    console.log('START SESSION');

    chrome.tabs.executeScript({
        'code': 'window.innerHeight'
    }, function (result) {
        console.log('browserX');
        console.log(result);
        this.browserX = result[0];
    }.bind(this));

    chrome.tabs.executeScript({
        'code': 'window.innerWidth'
    }, function (result) {
        console.log('browserY');
        console.log(result);
        this.browserY = result[0];
    }.bind(this));

    //chrome.tabs.executeScript({ 'file': '/assets/js/getSOQuestions.js' });

    var queryInfo = {
        active: true,
        currentWindow: true
    };
    var url = tab.url;
    var id = tab.id;
    console.log(url);

    var urlRegex = /^https?:\/\/(?:[^./?#]+\.)?stackoverflow\.com/;

    if (urlRegex.test(url)) {
        // ...if it matches, send a message specifying a callback too
        chrome.tabs.sendMessage(id, { text: 'get_question' }, this.receiveQuestion);
        chrome.tabs.sendMessage(id, { text: 'get_answers'  }, this.receiveAnswers );
    }

    var websocket = new WebSocket('ws://localhost:7007');

    // listen for eye gaze data coming from the server
    websocket.onmessage = function (e) {
        // deal with incoming eyegaze data
        var eyeGazeData = e.data;
        var timeStamp = eyeGazeData.substring(0, eyeGazeData.indexOf(','));

        var coordString = eyeGazeData.substring(eyeGazeData.indexOf(',') + 1);

        var x = coordString.substring(0                           , coordString.indexOf(','));
        var y = coordString.substring(coordString.indexOf(',') + 1, coordString.length      );

        // parse values
        x = parseInt(x);
        y = parseInt(y);

        // get translated coordinates
        var coords = translateCoordinates(x, y);

        if (!coords) {
            // user is not looking in the html viewport
        } else {
            // user is looking in the html viewport
            // need to check which website the user is looking at
            chrome.tabs.query({ 'active': true }, function (tabs) {
                var url = tabs[0].url;
                this.currentTab = tabs[0];
                if (url.includes('stackoverflow.com/questions/')) {
                    chrome.tabs.sendMessage(id, { text: 'get_so_coordinate', x: x, y: y  }, this.getSOElementResult );
                }
                if (url.includes('bugzilla')) { // NOTE: This include may be incorect, will need to do some more research
                    
                }
            }.bind(this));
        }
    }.bind(this);
}.bind(this));