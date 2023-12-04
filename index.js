//Webex Bot Starter - featuring the webex-node-bot-framework - https://www.npmjs.com/package/webex-node-bot-framework
require("dotenv").config();
const { exec } = require("child_process");
const cron = require("node-cron");
const fs = require("fs");
const yaml = require("js-yaml");
var framework = require("webex-node-bot-framework");
var webhook = require("webex-node-bot-framework/webhook");
var express = require("express");
var bodyParser = require("body-parser");
var app = express();
app.use(bodyParser.json());
app.use(express.static("images"));
const config = {
  // webhookUrl: process.env.WEBHOOKURL,
  token: process.env.BOTTOKEN,
  // port: process.env.PORT,
};

const yamlFilePath = "./featureFlags.yaml";
let oldFeatureFlags;
const threeMonthsInSeconds = 90 * 24 * 60 * 60;
let bots=[]
// cron.schedule("* * * * *", async () => {
//   console.log("Running daily task to send Feature Flags card");
//   try {
//     for (const bot of bots) {
//       sendCardWithoutCommand(bot);
//       console.log(`Feature Flags card sent successfully for bot: ${bot.botName}`);
//     }
//     console.log("Feature Flags card sent successfully");
//   } catch (error) {
//     console.error("Error in daily task:", error.message);
//   }
// });
// process.stdin.resume();

// init framework
var framework = new framework(config);
framework.start();
console.log("Starting framework, please wait...");

framework.on("initialized", () => {
  console.log("framework is all fired up! [Press CTRL-C to quit]");
});

// A spawn event is generated when the framework finds a space with your bot in it
// If actorId is set, it means that user has just added your bot to a new space
// If not, the framework has discovered your bot in an existing space
framework.on("spawn", (bot, id, actorId) => {
  bots.push(bot);
  // Schedule the cron job after the bot is spawned
  cron.schedule("*/2 * * * *", async () => {
    console.log(`Running daily task to send Feature Flags card for bot: ${bot.room.title}`);
    try {
      sendCardWithoutCommand(bot);
    } catch (error) {
      console.error(`Error in daily task for bot ${bot.room.title}:`, error.message);
    }
  });
  if (!actorId) {
    // don't say anything here or your bot's spaces will get
    // spammed every time your server is restarted
    console.log(
      `While starting up, the framework found our bot in a space called: ${bot.room.title}`
    );
  } else {
    // When actorId is present it means someone added your bot got added to a new space
    // Lets find out more about them..
    var msg =
      "I notify at 4:00PM everyday the feature flags eligible for cleanup. Cleanup actions are performed based on your consent.";
    bot.webex.people
      .get(actorId)
      .then((user) => {
        msg = `Hello there ${user.displayName}. ${msg}`;
      })
      .catch((e) => {
        console.error(
          `Failed to lookup user details in framwork.on("spawn"): ${e.message}`
        );
        msg = `Hello there. ${msg}`;
      })
      .finally(() => {
        // Say hello, and tell users what you do!
        if (bot.isDirect) {
          bot.say("markdown", msg);
        } else {
          let botName = bot.person.displayName;
          // msg += `\n\nDon't forget, in order for me to see your messages in this group space, be sure to *@mention* ${botName}.`;
          bot.say("markdown", msg);
        }
      });
  }
});

// Implementing a framework.on('log') handler allows you to capture
// events emitted from the framework.  Its a handy way to better understand
// what the framework is doing when first getting started, and a great
// way to troubleshoot issues.
// You may wish to disable this for production apps
framework.on("log", (msg) => {
  console.log(msg);
});

/* Send card with FF details and the input text box
ex Bot will respond with a card containing FF details - https://developer.webex.com/docs/api/guides/cards
User can then enter text in the input box
*/
const sendCardWithoutCommand = (bot, trigger) => {
  console.log("someone asked for a form");
  oldFeatureFlags = getOldFeatureFlags(yamlFilePath);
  const oldFeatureFlagsString = oldFeatureFlags
    .map((ff) => `${ff.name}: \n${ff.age}`)
    .join("\n");
  console.log("Feature Flags eligible for removal:", oldFeatureFlagsString);
  const myCardJSON = {
    $schema: "http://adaptivecards.io/schemas/adaptive-card.json",
    type: "AdaptiveCard",
    version: "1.0",
    body: [
      {
        type: "ColumnSet",
        columns: [
          {
            type: "Column",
            width: 2,
            items: [
              {
                type: "TextBlock",
                text: "Below are the FF eligible for removal",
                weight: "bolder",
                size: "medium",
                wrap: true,
              },
              {
                type: "TextBlock",
                text: oldFeatureFlagsString,
                wrap: true,
              },
              {
                type: "TextBlock",
                text: "Enter the FF to remove separated by comma",
                isSubtle: true,
                size: "small",
                wrap: true,
              },
              {
                type: "Input.Text",
                id: "FeaturesToRemove",
                placeholder: "FF1,FF2",
                isSubtle: true,
                size: "small",
              },
            ],
          },
          {
            type: "Column",
            width: 1,
            items: [
              {
                type: "Image",
                url: "https://upload.wikimedia.org/wikipedia/commons/4/44/FeatureFlag.png",
                size: "auto",
              },
            ],
          },
        ],
      },
    ],
    actions: [
      {
        type: "Action.Submit",
        title: "Remove",
      },
    ],
  };
 if(oldFeatureFlags.length > 0){
    bot.sendCard(
      myCardJSON,
      "This is customizable fallback text for clients that do not support buttons & cards"
    );
    console.log(`Feature Flags card sent successfully for bot: ${bot.room.title}`);
  }else{
    bot.say('No Feature Flags eligible for removal');
  }
};

framework.hears(
  "send me a form",
  (bot, trigger) => {
    // This callback is called if a user enters any text that includes the word 'help'
    // Send a card to the user.
    sendCardWithoutCommand(bot, trigger);
  },
  "**send me a form**: (a cool form!)",
  0
);

// Process a submitted card
framework.on("attachmentAction", (bot, trigger) => {
  let featureList = [];
  const FeaureInput = trigger.attachmentAction.inputs.FeaturesToRemove;

  if (FeaureInput && FeaureInput.trim() !== "") {
    // Split the nameInput based on commas and store in the nameList
    const features = FeaureInput.split(",").map((feature) => feature.trim());

    // Add the names to the list
    featureList.push(...features);
  }
  const featuresString = featureList.join(",");
  console.log( `triggerred jenkins job for removal: ${featuresString}`);
  let command = `curl -I -u supatlol:11173df0b8b0b7e3104794722b3782a53f "https://engci-private-sjc.cisco.com/jenkins/ccbu-cc-one/view/analyzer-ui-jobs/job/Analyzer-ui-k8s/job/Analyzer-Util-Jobs/job/FF-Cleanup-From-SourceCode/buildWithParameters?token=dummytoken&FeautureFlags=${featuresString}"`;
  exec(command, (error, stdout, stderr) => {
    if (error) {
        console.log(`error: ${error.message}`);
        return;
    }
    if (stderr) {
        console.log(`stderr: ${stderr}`);
        return;
    }
    console.log(`stdout: ${stdout}`);
  });
  // bot.say(`Got an attachmentAction:\n${JSON.stringify(trigger.attachmentAction, null, 2)}`);
  bot.say(`Triggered jenkins to remove FF: \n${featureList}`);
});

function getOldFeatureFlags(filePath) {
  try {
    // Read the YAML file
    const yamlContent = fs.readFileSync(filePath, "utf8");
    console.log(`yamlContent: ${yamlContent}`);
    // Parse YAML content
    const data = yaml.load(yamlContent);
    console.log(`data: ${data}`);
    // Get current timestamp
    const currentTimestamp = Math.floor(Date.now() / 1000);
    console.log(`Object.keys(data): ${Object.keys(data)}`);
    // Filter Feature Flags older than 3 months
    const oldFeatureFlags = Object.keys(data)
      .filter((ffName) => {
        const createdTimestamp = data[ffName].createdon;
        // Calculate the difference in seconds
        const diffInSeconds = currentTimestamp - createdTimestamp;
        console.log(
          `ffName: ${ffName} currentTimestamp: ${currentTimestamp} createdTimestamp: ${createdTimestamp} diffInSeconds: ${diffInSeconds}`
        );

        // 3 months is approximately 90 days
        console.log(`threeMonthsInSeconds: ${threeMonthsInSeconds}`);
        return diffInSeconds > threeMonthsInSeconds;
      })
      .map((ffName) => ({
        name: ffName,
        age: secondsToHumanReadable(currentTimestamp - data[ffName].createdon),
        // defaultMode: data[ffName].default
      }));

    return oldFeatureFlags;
  } catch (error) {
    console.error("Error reading or parsing YAML file:", error.message);
    return [];
  }
}

function secondsToHumanReadable(seconds) {
  const months = Math.floor(seconds / (30 * 24 * 60 * 60));
  const days = Math.floor((seconds % (30 * 24 * 60 * 60)) / (24 * 60 * 60));
  return `${months} months, ${days} days`;
}

/* On mention with command
ex User enters @botname help, the bot will write back in markdown
 *
 * The framework.showHelp method will use the help phrases supplied with the previous
 * framework.hears() commands
*/
framework.hears(
  /help|what can i (do|say)|what (can|do) you do/i,
  (bot, trigger) => {
    console.log(`someone needs help! They asked ${trigger.text}`);
    bot
      .say(`Hello ${trigger.person.displayName}.`)
      //    .then(() => sendHelp(bot))
      .then(() => bot.say("markdown", framework.showHelp()))
      .catch((e) => console.error(`Problem in help hander: ${e.message}`));
  },
  "**help**: (what you are reading now)",
  0
);

/* On mention with unexpected bot command
   Its a good practice is to gracefully handle unexpected input
   Setting the priority to a higher number here ensures that other 
   handlers with lower priority will be called instead if there is another match
*/
framework.hears(
  /.*/,
  (bot, trigger) => {
    // This will fire for any input so only respond if we haven't already
    console.log(`catch-all handler fired for user input: ${trigger.text}`);
    bot
      .say(`Sorry, I don't know how to respond to "${trigger.text}"`)
      .then(() => bot.say("markdown", framework.showHelp()))
      //    .then(() => sendHelp(bot))
      .catch((e) =>
        console.error(`Problem in the unexepected command hander: ${e.message}`)
      );
  },
  99999
);

//Server config & housekeeping
// Health Check
app.get("/", (req, res) => {
  res.send(`I'm alive.`);
});

app.post("/", webhook(framework));

app.post("/FFDetails", (req, res) => {
  // Handle the incoming POST request data (req.body)
  console.log("Received POST request for FFDetails:", req.body);

  // Add your logic here to process the received data

  // Send a response (optional)
  res.status(200).json({ message: "POST request received successfully" });
});

var server = app.listen(config.port, () => {
  framework.debug("framework listening on port %s", config.port);
});

// gracefully shutdown (ctrl-c)
process.on("SIGINT", () => {
  framework.debug("stopping...");
  server.close();
  framework.stop().then(() => {
    process.exit();
  });
});
