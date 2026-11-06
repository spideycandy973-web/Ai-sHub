package com.aishub;

import android.accessibilityservice.AccessibilityService;
import android.os.Bundle;
import android.view.accessibility.AccessibilityEvent;
import android.view.accessibility.AccessibilityNodeInfo;

import java.util.ArrayList;
import java.util.List;

/**
 * Ai'sHub control — optional accessibility service.
 *
 * When the user turns this on, the in-app assistant can perform the actions a
 * person would: go back / home / recents, tap a button by its label, type into
 * the focused field and read what is on screen.
 *
 * It never runs on its own: every action is a direct result of something the
 * user asked the assistant to do. Turning it off in Settings → Accessibility
 * disables the whole capability again.
 */
public class AiHubAccessibilityService extends AccessibilityService {

    static volatile AiHubAccessibilityService instance;

    @Override
    public void onServiceConnected() {
        super.onServiceConnected();
        instance = this;
    }

    @Override
    public void onDestroy() {
        instance = null;
        super.onDestroy();
    }

    @Override
    public void onAccessibilityEvent(AccessibilityEvent event) {
        // Purely on-demand: we read the tree when the user asks for it.
    }

    @Override
    public void onInterrupt() {
        // nothing to interrupt — actions are one-shot
    }

    /* ─────────────────────────── actions ─────────────────────────── */

    /** Find a node whose text/content-description matches and click it. */
    boolean tapByText(String query) {
        if (query == null || query.trim().isEmpty()) return false;
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        String needle = query.trim().toLowerCase();

        List<AccessibilityNodeInfo> matches = new ArrayList<>();
        collect(root, needle, matches, 0);
        for (AccessibilityNodeInfo node : matches) {
            AccessibilityNodeInfo clickable = node;
            int guard = 0;
            while (clickable != null && !clickable.isClickable() && guard++ < 8) {
                clickable = clickable.getParent();
            }
            if (clickable != null && clickable.performAction(AccessibilityNodeInfo.ACTION_CLICK)) {
                return true;
            }
        }
        return false;
    }

    private void collect(AccessibilityNodeInfo node, String needle, List<AccessibilityNodeInfo> out, int depth) {
        if (node == null || depth > 60 || out.size() >= 40) return;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        String label = (text != null ? text.toString() : "") + " " + (desc != null ? desc.toString() : "");
        if (label.toLowerCase().contains(needle) && node.isVisibleToUser()) out.add(node);
        for (int i = 0; i < node.getChildCount(); i++) {
            collect(node.getChild(i), needle, out, depth + 1);
        }
    }

    /** Type into whatever text field currently has focus. */
    boolean typeText(String text) {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return false;
        AccessibilityNodeInfo focused = root.findFocus(AccessibilityNodeInfo.FOCUS_INPUT);
        if (focused == null) return false;
        Bundle args = new Bundle();
        args.putCharSequence(AccessibilityNodeInfo.ACTION_ARGUMENT_SET_TEXT_CHARSEQUENCE, text);
        return focused.performAction(AccessibilityNodeInfo.ACTION_SET_TEXT, args);
    }

    /** Flatten the visible screen into readable text. */
    String readScreen() {
        AccessibilityNodeInfo root = getRootInActiveWindow();
        if (root == null) return "";
        StringBuilder sb = new StringBuilder();
        flatten(root, sb, 0);
        String out = sb.toString().trim();
        return out.length() > 4000 ? out.substring(0, 4000) + "…" : out;
    }

    private void flatten(AccessibilityNodeInfo node, StringBuilder sb, int depth) {
        if (node == null || depth > 40 || sb.length() > 3800) return;
        CharSequence text = node.getText();
        CharSequence desc = node.getContentDescription();
        String line = text != null && text.length() > 0 ? text.toString()
            : desc != null && desc.length() > 0 ? desc.toString() : "";
        if (!line.trim().isEmpty() && node.isVisibleToUser()) {
            sb.append("- ").append(line.trim()).append('\n');
        }
        for (int i = 0; i < node.getChildCount(); i++) {
            flatten(node.getChild(i), sb, depth + 1);
        }
    }
}
