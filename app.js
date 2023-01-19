const express = require("express");
const { open } = require("sqlite");
const sqlite3 = require("sqlite3");
const bcrypt = require("bcrypt");
const jwt = require("jsonwebtoken");

const path = require("path");
const dbPath = path.join(__dirname, "twitterClone.db");

app = express();
app.use(express.json());

let db = null;

const initializationDbAndServer = async () => {
  try {
    db = await open({
      filename: dbPath,
      driver: sqlite3.Database,
    });
    app.listen(3000, () => {
      console.log("Server is running at http://localhost:3000/");
    });
  } catch (error) {
    console.log(`Db error '${error.message}'`);
    process.exit(1);
  }
};

initializationDbAndServer();

//api-1

app.post(`/register/`, async (request, response) => {
  const { name, username, gender, password } = request.body;
  //console.log(password);
  const hashedPassword = await bcrypt.hash(password, 10);
  //console.log(hashedPassword);
  const toCheckUserQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const toCheckUser = await db.get(toCheckUserQuery);
  //console.log(toCheckUser);
  if (toCheckUser === undefined) {
    if (password.length > 6) {
      const createUserQuery = `INSERT INTO user(name , username , password , gender) VALUES( 
          '${name}' , '${username}' , '${hashedPassword}' , '${gender}' 
      )`;
      const createUser = await db.run(createUserQuery);
      response.status(200);
      response.send("User created successfully");
    } else {
      response.status(400);
      response.send("Password is too short");
    }
  } else {
    response.status(400);
    response.send("User already exists");
  }
});

//api-2

app.post(`/login/`, async (request, response) => {
  const { password, username } = request.body;
  const isRegisteredQuery = `SELECT * FROM user WHERE username = '${username}';`;
  const isRegistered = await db.get(isRegisteredQuery);
  //response.send(isRegistered);
  if (isRegistered !== undefined) {
    const comparePassword = await bcrypt.compare(
      password,
      isRegistered.password
    );
    if (comparePassword === true) {
      const payload = { username: username };
      const jwtToken = jwt.sign(payload, "MY_secret_KEY");
      response.send({ jwtToken });
      //console.log({ jwtToken });
    } else {
      response.status(400);
      response.send("Invalid password");
    }
  } else {
    response.status(400);
    response.send("Invalid user");
  }
});

//authenticate access token - middleware function

const authenticateToken = (request, response, next) => {
  let jwtToken;
  const authHeader = request.headers["authorization"];
  if (authHeader !== undefined) {
    jwtToken = authHeader.split(" ")[1];
  }
  if (jwtToken !== undefined) {
    jwt.verify(jwtToken, "MY_secret_KEY", async (error, payload) => {
      if (error) {
        response.status(401);
        response.send("Invalid JWT Token");
      } else {
        request.username = payload.username;
        next();
      }
    });
  } else {
    response.status(401);
    response.send("Invalid JWT Token");
  }
};

//api-3

app.get(`/user/tweets/feed/`, authenticateToken, async (request, response) => {
  const { username } = request;
  /* get user id from user by using username */
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);

  /* to to following_user_id by using getUserId */
  const followerUserIdsQuery = `select following_user_id from follower where follower_user_id = '${getUserId.user_id}'`;
  const followerUserIds = await db.all(followerUserIdsQuery);
  //console.log(followerUserIds);

  /* keep the followerUserIds in array */
  const getTheArray = followerUserIds.map((each) => {
    return each.following_user_id;
  });
  //console.log(getTheArray);

  /* to get the tweets */
  const getTweetQuery = `select user.username , tweet.tweet , tweet.date_time as dateTime 
   from user inner join tweet on user.user_id = tweet.user_id where user.user_id in (${getTheArray}) 
   order by tweet.date_time desc limit 4 ;`;
  const result = await db.all(getTweetQuery);
  //console.log(result);
  response.send(result);
});

//api-4

app.get(`/user/following/`, authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getUsersQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
  const getUsers = await db.all(getUsersQuery);
  //console.log(getUsers);
  const getUsersIdArray = getUsers.map((each) => {
    return each.following_user_id;
  });
  //console.log(getUsersIdArray);
  const query = `select user.name from user  where 
   user.user_id in (${getUsersIdArray}); `;
  const result = await db.all(query);
  response.send(result);
});

//api-5

app.get(`/user/followers/`, authenticateToken, async (request, response) => {
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);
  const getUsersQuery = `select follower_user_id from follower where following_user_id = ${getUserId.user_id};`;
  const getUsers = await db.all(getUsersQuery);
  //console.log(getUsers);
  const getUsersIdArray = getUsers.map((each) => {
    return each.follower_user_id;
  });
  //console.log(getUsersIdArray);
  const query = `select user.name from user  where 
   user.user_id in (${getUsersIdArray}); `;
  const result = await db.all(query);
  response.send(result);
});

//api-6

const api6Output = (tweetData, likesCount, replyCount) => {
  return {
    tweet: tweetData.tweet,
    likes: likesCount.likes,
    replies: replyCount.replies,
    dateTime: tweetData.date_time,
  };
};

app.get(`/tweets/:tweetId/`, authenticateToken, async (request, response) => {
  const { tweetId } = response.params;
  const { username } = request;
  const getUserIdQuery = `select user_id from user where username = '${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  const getUsersQuery = `select following_user_id from follower where follower_user_id = ${getUserId.user_id};`;
  const getUsers = await db.all(getUsersQuery);
  const requestArray = getUsers.map((each) => {
    return each.following_user_id;
  });
  //console.log(requestArray);
  const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const followingTweetIds = getTweetIdsArray.map((eachId) => {
    return eachId.tweet_id;
  });
  //console.log(followingTweetIds);
  if (followingTweetIds.includes(parseInt(tweetId))) {
    const likes_count_query = `select count(user_id) as likes from like where tweet_id=${tweetId};`;
    const likes_count = await db.get(likes_count_query);
    //console.log(likes_count);
    const reply_count_query = `select count(user_id) as replies from reply where tweet_id=${tweetId};`;
    const reply_count = await db.get(reply_count_query);
    // console.log(reply_count);
    const tweet_tweetDateQuery = `select tweet, date_time from tweet where tweet_id=${tweetId};`;
    const tweet_tweetDate = await db.get(tweet_tweetDateQuery);
    //console.log(tweet_tweetDate);
    response.send(api6Output(tweet_tweetDate, likes_count, reply_count));
  } else {
    response.status(401);
    response.send("Invalid Request");
    // console.log("Invalid Request");
  }
});

//api-7
const convertLikedUserNameDBObjectToResponseObject = (dbObject) => {
  return {
    likes: dbObject,
  };
};
app.get(
  `/tweets/:tweetId/likes/`,
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    const getFollowingIdsQuery = `select following_user_id from follower where follower_user_id=${getUserId.user_id};`;
    const getFollowingIdsArray = await db.all(getFollowingIdsQuery);
    //console.log(getFollowingIdsArray);
    const getFollowingIds = getFollowingIdsArray.map((eachFollower) => {
      return eachFollower.following_user_id;
    });
    //console.log(getFollowingIds);

    const getTweetIdsQuery = `select tweet_id from tweet where user_id in (${getFollowingIds});`;
    const getTweetIdsArray = await db.all(getTweetIdsQuery);
    const getTweetIds = getTweetIdsArray.map((eachTweet) => {
      return eachTweet.tweet_id;
    });
    //console.log(getTweetIds);
    //console.log(getTweetIds.includes(parseInt(tweetId)));
    if (getTweetIds.includes(parseInt(tweetId))) {
      const getLikedUsersNameQuery = `select user.username as likes from user inner join like
       on user.user_id=like.user_id where like.tweet_id=${tweetId};`;
      const getLikedUserNamesArray = await db.all(getLikedUsersNameQuery);
      //console.log(getLikedUserNamesArray);
      const getLikedUserNames = getLikedUserNamesArray.map((eachUser) => {
        return eachUser.likes;
      });
      // console.log(getLikedUserNames);
      /*console.log(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );*/
      response.send(
        convertLikedUserNameDBObjectToResponseObject(getLikedUserNames)
      );
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

//api9
app.get("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId);

  //get tweets made by user
  const getTweetIdsQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
  const getTweetIdsArray = await db.all(getTweetIdsQuery);
  const getTweetIds = getTweetIdsArray.map((eachId) => {
    return parseInt(eachId.tweet_id);
  });
  //console.log(getTweetIds);
});

//api-10

app.post("/user/tweets/", authenticateToken, async (request, response) => {
  let { username } = request;
  const getUserIdQuery = `select user_id from user where username='${username}';`;
  const getUserId = await db.get(getUserIdQuery);
  //console.log(getUserId.user_id);
  const { tweet } = request.body;
  //console.log(tweet);
  //const currentDate = format(new Date(), "yyyy-MM-dd HH-mm-ss");
  const currentDate = new Date();
  console.log(currentDate.toISOString().replace("T", " "));

  const postRequestQuery = `insert into tweet(tweet, user_id, date_time) values ("${tweet}", ${getUserId.user_id}, '${currentDate}');`;

  const responseResult = await db.run(postRequestQuery);
  const tweet_id = responseResult.lastID;
  response.send("Created a Tweet");
});

//api-11
app.delete(
  "/tweets/:tweetId/",
  authenticateToken,
  async (request, response) => {
    const { tweetId } = request.params;
    //console.log(tweetId);
    let { username } = request;
    const getUserIdQuery = `select user_id from user where username='${username}';`;
    const getUserId = await db.get(getUserIdQuery);
    //console.log(getUserId.user_id);
    //tweets made by the user
    const getUserTweetsListQuery = `select tweet_id from tweet where user_id=${getUserId.user_id};`;
    const getUserTweetsListArray = await db.all(getUserTweetsListQuery);
    const getUserTweetsList = getUserTweetsListArray.map((eachTweetId) => {
      return eachTweetId.tweet_id;
    });
    console.log(getUserTweetsList);
    if (getUserTweetsList.includes(parseInt(tweetId))) {
      const deleteTweetQuery = `delete from tweet where tweet_id=${tweetId};`;
      await db.run(deleteTweetQuery);
      response.send("Tweet Removed");
    } else {
      response.status(401);
      response.send("Invalid Request");
    }
  }
);

module.exports = app;
