const http = require('http');
const { createApp } = require('./src/app');
const { pingDatabase, db } = require('./src/db');
const userService = require('./src/services/userService');
const conversationService = require('./src/services/conversationService');
const messageService = require('./src/services/messageService');

async function runSmokeTest() {
  console.log('--- STARTING SENI CHAT BACKEND SMOKE TEST ---');

  // 1. Database & Migrations
  await pingDatabase();
  console.log('✓ Database connected and migrations verified');

  // 2. User registration
  const rand = Math.floor(Math.random() * 100000);
  const userA = await userService.createUser({
    username: `alice_${rand}`,
    email: `alice_${rand}@example.com`,
    password: 'Password123!',
  });
  const userB = await userService.createUser({
    username: `bob_${rand}`,
    email: `bob_${rand}@example.com`,
    password: 'Password123!',
  });
  console.log('✓ Users created:', userA.username, 'and', userB.username);

  // 3. User authentication
  const authA = await userService.authenticate(userA.username, 'Password123!');
  if (authA.id !== userA.id) throw new Error('Authentication failed for user A');
  console.log('✓ User authentication verified');

  // 4. User search
  const searchResults = await userService.searchUsers(`bob_${rand}`, userA.id);
  if (!searchResults.some((u) => u.id === userB.id)) {
    throw new Error('Search failed to find user B');
  }
  console.log('✓ Search returned user B correctly');

  // 5. Conversation creation
  const conv = await conversationService.getOrCreate(userA.id, userB.id);
  console.log('✓ Conversation created/retrieved:', conv.id);

  // 6. Sending a message
  const msg1 = await messageService.createMessage(conv.id, userA.id, 'Hello Bob! This is message 1');
  console.log('✓ Message created:', msg1.id);

  // 7. Batched conversation list for user B
  const listB = await conversationService.listForUser(userB.id);
  const convB = listB.find((c) => c.id === conv.id);
  if (!convB || convB.unreadCount !== 1) {
    throw new Error(`Expected unreadCount 1 for Bob, got ${convB?.unreadCount}`);
  }
  console.log('✓ Batched list verified with unreadCount:', convB.unreadCount);

  // 8. Mark conversation read by Bob
  const readResult = await messageService.markConversationRead(conv.id, userB.id);
  if (!readResult.markedMessageIds.includes(msg1.id)) {
    throw new Error('Message was not marked read');
  }
  console.log('✓ Message marked read successfully');

  // 9. Edit message by Alice
  const edited = await messageService.editMessage(msg1.id, userA.id, 'Hello Bob! Edited message');
  if (edited.body !== 'Hello Bob! Edited message' || !edited.editedAt) {
    throw new Error('Message edit failed');
  }
  console.log('✓ Message edit successful, editedAt:', edited.editedAt);

  // 10. Check edit history
  const history = await messageService.editHistory(msg1.id, userA.id);
  if (history.length !== 1 || history[0].previousBody !== 'Hello Bob! This is message 1') {
    throw new Error('Edit history did not preserve previous body');
  }
  console.log('✓ Message edit history verified successfully');

  // 11. Reply to message from Bob
  const replyMsg = await messageService.createMessage(
    conv.id,
    userB.id,
    'Replying to your message!',
    msg1.id
  );
  if (!replyMsg.replyTo || replyMsg.replyTo.id !== msg1.id) {
    throw new Error('Reply message did not attach replyTo parent');
  }
  console.log('✓ Message reply verified, quoting sender:', replyMsg.replyTo.senderUsername);

  // 12. Toggle reaction on message
  const react1 = await messageService.toggleReaction(replyMsg.id, userA.id, '🔥');
  if (react1.reactions.length !== 1 || react1.reactions[0].emoji !== '🔥' || !react1.reactions[0].hasReacted) {
    throw new Error('Reaction failed to apply');
  }
  console.log('✓ Emoji reaction 🔥 applied successfully');

  // Toggle off (un-react)
  const react2 = await messageService.toggleReaction(replyMsg.id, userA.id, '🔥');
  if (react2.reactions.length !== 0) {
    throw new Error('Reaction failed to toggle off');
  }
  console.log('✓ Emoji reaction toggle off verified');

  // 13. Soft-delete message by Alice
  const deleted = await messageService.deleteMessage(msg1.id, userA.id);
  if (!deleted.deleted) {
    throw new Error('Soft delete failed');
  }
  console.log('✓ Message soft delete verified');

  console.log('--- ALL SMOKE TESTS PASSED WITH ZERO ERRORS ---');
  process.exit(0);
}

runSmokeTest().catch((err) => {
  console.error('Smoke test failed with error:', err);
  process.exit(1);
});
