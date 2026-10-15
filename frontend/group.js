// groups.js - group chat routes for the backend (Node + Express + Mongoose)
//
// 1. Put this file next to your server file (or in your routes folder).
// 2. Fix the two require() paths below so they match your project.
// 3. In your server file add:   app.use(require("./groups"));
//
// Routes:
//   POST /groups                 create a group { name, memberIds: [...] }
//   GET  /groups                 groups you belong to
//   GET  /groups/:id/messages    latest 200 messages of a group
//   POST /groups/:id/messages    send a message { text }
//   GET  /groups/:id             group details with member names
//   POST /groups/:id/members     add people { memberIds: [...] } (any member can add)
//   POST /groups/:id/leave       leave the group (an empty group is deleted)

const express = require("express");
const mongoose = require("mongoose");

const router = express.Router();

const auth = require("./middleware/auth"); // your existing token check
const User = require("./models/User");     // your existing User model

// If your auth middleware stores the user id somewhere else, change it here
const getMyId = req => String(req.user?.id ?? req.user?._id ?? req.userId ?? "");

const MAX_MEMBERS = 50;
const MAX_TEXT = 2000;


/* =========================
   MODELS
========================= */

const groupSchema = new mongoose.Schema(
    {
        name: { type: String, required: true, trim: true, maxlength: 40 },
        members: [{ type: mongoose.Schema.Types.ObjectId, ref: "User" }],
        createdBy: { type: mongoose.Schema.Types.ObjectId, ref: "User" }
    },
    { timestamps: true }
);

const groupMessageSchema = new mongoose.Schema(
    {
        groupId: { type: mongoose.Schema.Types.ObjectId, ref: "Group", index: true },
        senderId: { type: mongoose.Schema.Types.ObjectId, ref: "User" },
        text: { type: String, required: true, trim: true, maxlength: MAX_TEXT }
    },
    { timestamps: true }
);

const Group = mongoose.models.Group || mongoose.model("Group", groupSchema);
const GroupMessage =
    mongoose.models.GroupMessage || mongoose.model("GroupMessage", groupMessageSchema);


/* =========================
   HELPERS
========================= */

// Finds the group and makes sure the signed-in user is a member of it
async function getMyGroup(req, res) {
    if (!mongoose.isValidObjectId(req.params.id)) {
        res.status(400).json({ message: "Invalid group." });
        return null;
    }

    const group = await Group.findById(req.params.id);
    const myId = getMyId(req);

    if (!group || !group.members.some(member => String(member) === myId)) {
        res.status(404).json({ message: "Group not found." });
        return null;
    }

    return group;
}

function publicGroup(group) {
    return {
        _id: group._id,
        name: group.name,
        members: group.members,
        createdBy: group.createdBy,
        isGroup: true
    };
}


/* =========================
   CREATE A GROUP
========================= */

router.post("/groups", auth, async (req, res) => {
    try {
        const myId = getMyId(req);
        const name = String(req.body.name ?? "").trim();
        const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];

        if (!myId) {
            return res.status(401).json({ message: "Please sign in again." });
        }

        if (!name || name.length > 40) {
            return res.status(400).json({ message: "Give the group a name (up to 40 characters)." });
        }

        // Remove duplicates and yourself, keep only real ids
        const others = [...new Set(memberIds.map(String))]
            .filter(id => id !== myId && mongoose.isValidObjectId(id));

        if (others.length < 2) {
            return res.status(400).json({ message: "A group needs at least 2 other people." });
        }

        if (others.length + 1 > MAX_MEMBERS) {
            return res.status(400).json({ message: `A group can have up to ${MAX_MEMBERS} people.` });
        }

        const found = await User.countDocuments({ _id: { $in: others } });

        if (found !== others.length) {
            return res.status(400).json({ message: "Some of the selected people do not exist." });
        }

        const group = await Group.create({
            name,
            members: [myId, ...others],
            createdBy: myId
        });

        res.status(201).json(publicGroup(group));
    } catch (error) {
        console.error("Create group error:", error);
        res.status(500).json({ message: "Could not create the group." });
    }
});


/* =========================
   LIST MY GROUPS
========================= */

router.get("/groups", auth, async (req, res) => {
    try {
        const groups = await Group.find({ members: getMyId(req) }).sort({ updatedAt: -1 });

        res.json(groups.map(publicGroup));
    } catch (error) {
        console.error("List groups error:", error);
        res.status(500).json({ message: "Could not load groups." });
    }
});


/* =========================
   GROUP MESSAGES
========================= */

router.get("/groups/:id/messages", auth, async (req, res) => {
    try {
        const group = await getMyGroup(req, res);

        if (!group) {
            return;
        }

        // Newest 200, then put them back in oldest-to-newest order
        const messages = await GroupMessage.find({ groupId: group._id })
            .sort({ createdAt: -1 })
            .limit(200)
            .populate("senderId", "username name");

        messages.reverse();

        res.json(
            messages.map(message => ({
                _id: message._id,
                senderId: message.senderId ? String(message.senderId._id) : "",
                senderName: message.senderId
                    ? (message.senderId.username || message.senderId.name || "Unknown")
                    : "Deleted user",
                text: message.text,
                createdAt: message.createdAt
            }))
        );
    } catch (error) {
        console.error("Load group messages error:", error);
        res.status(500).json({ message: "Could not load messages." });
    }
});

router.post("/groups/:id/messages", auth, async (req, res) => {
    try {
        const group = await getMyGroup(req, res);

        if (!group) {
            return;
        }

        const text = String(req.body.text ?? "").trim();

        if (!text) {
            return res.status(400).json({ message: "Message cannot be empty." });
        }

        if (text.length > MAX_TEXT) {
            return res.status(400).json({ message: `Message is too long (max ${MAX_TEXT} characters).` });
        }

        const message = await GroupMessage.create({
            groupId: group._id,
            senderId: getMyId(req),
            text
        });

        // Moves this group to the top of everyone's list
        await Group.findByIdAndUpdate(group._id, { $currentDate: { updatedAt: true } });

        res.status(201).json({
            _id: message._id,
            senderId: getMyId(req),
            text: message.text,
            createdAt: message.createdAt
        });
    } catch (error) {
        console.error("Send group message error:", error);
        res.status(500).json({ message: "Could not send message." });
    }
});


/* =========================
   GROUP DETAILS (member names)
========================= */

router.get("/groups/:id", auth, async (req, res) => {
    try {
        const group = await getMyGroup(req, res);

        if (!group) {
            return;
        }

        await group.populate("members", "username name");

        res.json({
            _id: group._id,
            name: group.name,
            createdBy: group.createdBy,
            isGroup: true,
            members: group.members.map(member => ({
                _id: member._id,
                username: member.username || member.name || "Unknown"
            }))
        });
    } catch (error) {
        console.error("Group details error:", error);
        res.status(500).json({ message: "Could not load the group." });
    }
});


/* =========================
   ADD PEOPLE TO A GROUP
========================= */

router.post("/groups/:id/members", auth, async (req, res) => {
    try {
        const group = await getMyGroup(req, res);

        if (!group) {
            return;
        }

        const memberIds = Array.isArray(req.body.memberIds) ? req.body.memberIds : [];
        const existing = new Set(group.members.map(String));

        // Only new, valid ids
        const newIds = [...new Set(memberIds.map(String))]
            .filter(id => mongoose.isValidObjectId(id) && !existing.has(id));

        if (newIds.length === 0) {
            return res.status(400).json({ message: "Pick at least 1 new person to add." });
        }

        if (group.members.length + newIds.length > MAX_MEMBERS) {
            return res.status(400).json({ message: `A group can have up to ${MAX_MEMBERS} people.` });
        }

        const found = await User.countDocuments({ _id: { $in: newIds } });

        if (found !== newIds.length) {
            return res.status(400).json({ message: "Some of the selected people do not exist." });
        }

        group.members.push(...newIds);
        await group.save();

        res.json(publicGroup(group));
    } catch (error) {
        console.error("Add members error:", error);
        res.status(500).json({ message: "Could not add people." });
    }
});


/* =========================
   LEAVE A GROUP
========================= */

router.post("/groups/:id/leave", auth, async (req, res) => {
    try {
        const group = await getMyGroup(req, res);

        if (!group) {
            return;
        }

        const myId = getMyId(req);

        group.members = group.members.filter(member => String(member) !== myId);

        if (group.members.length === 0) {
            // Nobody is left, so remove the group and its messages
            await GroupMessage.deleteMany({ groupId: group._id });
            await group.deleteOne();
        } else {
            // If the creator leaves, the oldest remaining member becomes the creator
            if (String(group.createdBy) === myId) {
                group.createdBy = group.members[0];
            }

            await group.save();
        }

        res.json({ message: "You left the group." });
    } catch (error) {
        console.error("Leave group error:", error);
        res.status(500).json({ message: "Could not leave the group." });
    }
});

module.exports = router;
