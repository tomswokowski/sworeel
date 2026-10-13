<script setup lang="ts">
// What the library shows before there are any reels: how to get the plugin when it is missing,
// and what to ask Claude for once it is there.
defineProps<{ plugin: boolean }>()
const emit = defineEmits<{ copy: [text: string] }>()

/** The same request the website gives; Claude follows the steps at that address. */
const SETUP = 'Set up SwoReel for me. Follow the steps at https://sworeel.com/setup.md'
const IDEAS = ['Make a reel of how a request reaches the database', 'Explain this function as a reel, step by step', 'Chart these numbers as a reel']
</script>

<template>
  <section class="welcome">
    <template v-if="plugin">
      <h2>Make Your First Reel</h2>
      <p>Reels are made by asking Claude Code. Ask for one and it shows up here by itself.</p>
      <ul>
        <li v-for="idea in IDEAS" :key="idea">
          <span>{{ idea }}</span>
          <button @click="emit('copy', idea)">Copy</button>
        </li>
      </ul>
      <p class="aside">Or type <code>/sworeel</code> in Claude Code to browse reels there.</p>
    </template>

    <template v-else>
      <h2>SwoReel Works Inside Claude Code</h2>
      <p>Reels are made by asking Claude. This app is where you browse, play and export them, so it needs the SwoReel plugin for Claude Code.</p>
      <ol>
        <li>
          <span>Install Claude Code, if you haven't: <b>claude.com/claude-code</b></span>
        </li>
        <li>
          <span>Paste this into Claude Code, and it does the rest:</span>
          <div class="request">
            <code>{{ SETUP }}</code>
            <button class="primary" @click="emit('copy', SETUP)">Copy</button>
          </div>
        </li>
        <li>
          <span>Restart Claude Code, then ask it for a reel. This screen changes by itself once the plugin is there.</span>
        </li>
      </ol>
      <p class="aside">More at <b>sworeel.com</b></p>
    </template>
  </section>
</template>

<style scoped>
.welcome {
  width: min(38rem, calc(100% - 2rem));
  margin: 3rem auto;
  padding: 1.5rem 1.75rem;
  border: 1px solid var(--border);
  border-radius: 0.75rem;
  background: var(--surface);
}

h2 {
  margin: 0 0 0.5rem;
  font-size: 1.25rem;
}

p {
  margin: 0 0 1rem;
  color: var(--muted);
  line-height: 1.5;
}

ul,
ol {
  display: flex;
  flex-direction: column;
  gap: 0.6rem;
  margin: 0 0 1rem;
  padding: 0;
  list-style: none;
  counter-reset: step;
}

ul li {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.75rem;
  padding: 0.5rem 0.5rem 0.5rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg);
}

ol li {
  position: relative;
  padding-left: 2.25rem;
  line-height: 1.5;
  counter-increment: step;
}

ol li::before {
  position: absolute;
  top: 0;
  left: 0;
  width: 1.5rem;
  height: 1.5rem;
  border: 1px solid var(--accent);
  border-radius: 50%;
  color: var(--accent);
  font-size: 0.8rem;
  line-height: 1.5rem;
  text-align: center;
  content: counter(step);
}

.request {
  display: flex;
  align-items: center;
  gap: 0.75rem;
  margin-top: 0.5rem;
  padding: 0.5rem 0.5rem 0.5rem 0.9rem;
  border: 1px solid var(--border);
  border-radius: 0.5rem;
  background: var(--bg);
}

.request code {
  flex: 1;
  overflow-wrap: anywhere;
  user-select: text;
}

.primary {
  border-color: var(--accent);
  background: var(--accent);
  color: var(--bg);
  font-weight: 600;
}

b {
  color: var(--text);
  font-weight: 600;
  user-select: text;
}

.aside {
  margin: 0;
  font-size: 0.9rem;
}
</style>
