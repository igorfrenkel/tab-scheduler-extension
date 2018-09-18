const DB_KEY = "scheduled-actions";

chrome.runtime.onInstalled.addListener(function() {
  console.log("Tab Action Scheduler installed");
  chrome.alarms.create("cron", {
    "periodInMinutes": 1
  });
});

chrome.alarms.onAlarm.addListener(function(alarm) {
  console.debug("alarm", alarm, "called");
  triggerActionsAt(new Date());
});

const triggerActionsAt = (now) => {
  const nowClockTime = now.getHours()*60*60 + now.getMinutes()*60 + now.getSeconds();
  chrome.storage.local.get([DB_KEY], (result) => {
    const actions = result[DB_KEY];
    let action;
    for(let k in actions) {
      action = actions[k];
      console.debug("running action key:", k, "; action:", action);
      if (!wasTriggeredToday(action, now) && ((action.triggerClock + 60*5) >= nowClockTime)) {
        execute(action, now);
      } else {
        console.debug("did not execute action", action.key, "; triggered today:", wasTriggeredToday(action, now), "; trigger clock gte now: ", action.triggerClock >= nowClockTime);
      }
    }
  });
}

const wasTriggeredToday = (action, now) => {
  const lastTriggerTime = new Date(action.lastTriggerTime);
  return lastTriggerTime.getFullYear() == now.getFullYear() &&
    lastTriggerTime.getMonth() == now.getMonth() &&
    lastTriggerTime.getDay() == now.getDay();
}

const execute = (action, now) => {
  run(action.command);
  chrome.storage.local.get([DB_KEY], (result) => {
    result[DB_KEY][action.key].lastTriggerTime = now.getTime();
    chrome.storage.local.set(result);
  });
}

const run = (command) => {
  switch (command.action) {
    case "discard":
      console.debug("executing discard");
      runDiscardByUrl(command.criterion.url);
      break;
    default:
      console.error("Unknown command sent");
      break;
  }
  console.debug("executed action:", command.action, "; criterion:", command.criterion);
}

const runDiscardByUrl = (url) => {
  let query = { url: url, discarded: false };
  chrome.tabs.query(query, function(tabs) {
    if (tabs.length == 0)
      console.log("tab not found with url", url);
    tabs.forEach((tab) => {
      chrome.tabs.discard(tab.id, (discardedTab) => {
        const status = discardedTab === undefined ? "failed" : "succeeded";
        console.debug("discard of:", tab.id, "; status:", status);
        if (discardedTab === undefined) {
          console.debug("undiscarded tab was: ", tab);
        }
      });
    });
  });
};

// registerAction({hour: 18, minute: 25, second: 0}, true, { action: "discard", criterion: { url: "https://ca.yahoo.com/*" }});
const registerAction = (triggerClock, repeats, command, lastTriggerTime) => {
  let criteria = [];
  for (let k in command.criterion) {
    criteria.push(k + ":" + command.criterion[k]);
  }
  const key = `${triggerClock.hour};${triggerClock.minute};${triggerClock.second};${repeats};${command.action};${criteria.join(",")}`;
  chrome.storage.local.get([DB_KEY], (result) => {
    if (result[DB_KEY] === undefined)
      result[DB_KEY] = {};
    const action = {
      key: key,
      command: command,
      triggerClock: triggerClock.hour * 60 * 60 + triggerClock.minute * 60 + triggerClock.second,
      lastTriggerTime: lastTriggerTime.getTime(),
      repeats: repeats
    };
    result[DB_KEY][key] = action;
    chrome.storage.local.set(result, () => {
      console.debug("Added scheduled action", "key:", key, "action:", action);
    });
  });  
};

const clearDB = () => {
  let obj = {};
  obj[DB_KEY] = {};
  chrome.storage.local.set(obj);
}

const printDB = () => {
  chrome.storage.local.get([DB_KEY], (result) => {
    console.log("db", result);
  });
}

const printAlarms = () => {
  chrome.alarms.getAll((alarms) => {
    console.log("alarms", alarms);
  });
}

const clearAlarms = () => {
  chrome.alarms.clearAll((cleared) => {
    console.log("cleared", cleared);
  });
}