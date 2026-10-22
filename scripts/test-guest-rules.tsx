import React from 'react';
import { renderToString } from 'react-dom/server';
import { MyDocumentsView } from '../src/components/views/MyDocumentsView';
import { AskDocumentsView } from '../src/components/views/AskDocumentsView';
import { CompareDocumentsView } from '../src/components/views/CompareDocumentsView';
import { VerifyNumbersView } from '../src/components/views/VerifyNumbersView';
import { TestLabView } from '../src/components/views/TestLabView';
import { AuthUser } from '../src/lib/supabase';
import { ClarioDocument } from '../src/types';

interface TestResult {
  name: string;
  passed: boolean;
  details: string;
}

const results: TestResult[] = [];

function assert(condition: boolean, testName: string, passDetails: string, failDetails: string) {
  if (condition) {
    results.push({ name: testName, passed: true, details: passDetails });
    console.log(`[PASS] ${testName}: ${passDetails}`);
  } else {
    results.push({ name: testName, passed: false, details: failDetails });
    console.error(`[FAIL] ${testName}: ${failDetails}`);
  }
}

async function runTests() {
  console.log('--- Starting Clario Guest Mode & Persistence Verification Tests ---\n');

  const guestUser: AuthUser = {
    id: 'guest_test_id',
    email: 'guest@clario.local',
    isGuest: true,
  };

  const authenticatedUser: AuthUser = {
    id: 'user_auth_uuid_456',
    email: 'testuser@example.com',
    isGuest: false,
  };

  const userDoc: ClarioDocument = {
    id: 'doc-user-1',
    userId: 'user_auth_uuid_456',
    filename: 'UserUploadedPolicy.pdf',
    title: 'User Uploaded Policy',
    language: 'Tamil',
    pageCount: 3,
    processingStatus: 'completed',
    summary: 'A user document',
    pages: [
      { id: 'p1', pageNumber: 1, extractedText: 'Policy text page 1', ocrConfidence: 0.98 },
    ],
    createdAt: new Date().toISOString(),
    isGuest: false,
  };

  const noop = () => {};

  // TEST CASE 1: Signed-out guest: no documents displayed
  {
    const html = renderToString(
      <MyDocumentsView
        documents={[]}
        currentUser={guestUser}
        selectedDocId=""
        onSelectDocument={noop}
        onOpenViewer={noop}
        onNavigateToAsk={noop}
        onNavigateToVerify={noop}
        onDeleteDocument={noop}
        onRenameDocument={noop}
        onTriggerUpload={noop}
        onGoToAuth={noop}
      />
    );

    const hasNoSampleDocs =
      !html.includes('TamilNadu_CM_Health') &&
      !html.includes('UP_Krishi_Solar') &&
      !html.includes('National_Merit_Scholarship');
    const hasNoIndexedCount = !html.includes('Indexed') && !html.includes('5 Indexed');
    const hasNoDocCards = !html.includes('Ask') && !html.includes('Actions &amp; Verification');

    assert(
      hasNoSampleDocs && hasNoIndexedCount && hasNoDocCards,
      'Test 1: Signed-out guest: no documents displayed',
      'Confirmed zero documents rendered, zero sample/benchmark docs, and no "5 Indexed" badge for guest.',
      `Unexpected document content found in guest HTML: ${html.slice(0, 300)}`
    );
  }

  // TEST CASE 2: Signed-out guest: My Documents prompts sign-in
  {
    const myDocsHtml = renderToString(
      <MyDocumentsView
        documents={[]}
        currentUser={guestUser}
        selectedDocId=""
        onSelectDocument={noop}
        onOpenViewer={noop}
        onNavigateToAsk={noop}
        onNavigateToVerify={noop}
        onDeleteDocument={noop}
        onRenameDocument={noop}
        onTriggerUpload={noop}
        onGoToAuth={noop}
      />
    );

    const askHtml = renderToString(
      <AskDocumentsView
        document={null}
        currentUser={guestUser}
        answerLanguage="English"
        onOpenViewer={noop}
        onNavigateToMyDocs={noop}
        onGoToAuth={noop}
        onTriggerUpload={noop}
      />
    );

    const compareHtml = renderToString(
      <CompareDocumentsView
        documents={[]}
        currentUser={guestUser}
        onOpenViewer={noop}
        onGoToAuth={noop}
        onNavigateToMyDocs={noop}
      />
    );

    const verifyHtml = renderToString(
      <VerifyNumbersView
        documents={[]}
        currentUser={guestUser}
        onOpenViewer={noop}
        onGoToAuth={noop}
        onNavigateToMyDocs={noop}
      />
    );

    const testLabHtml = renderToString(
      <TestLabView
        documents={[]}
        currentUser={guestUser}
        onOpenViewer={noop}
        onGoToAuth={noop}
      />
    );

    // TEST CASE 2: Guest Mode Access Rules:
    // - My Documents MUST require sign-in
    // - Ask Documents, Compare, Verify, Test Lab MUST NOT block guests with sign-in prompts
    const hasSignInBtnMyDocs = myDocsHtml.includes('Sign In to Clario');
    const hasPromptTextMyDocs = myDocsHtml.includes('Sign In to Access My Documents');

    // Confirm Ask Documents does NOT block guests, but shows active guest workspace / upload
    const askDoesNotBlockGuest = !askHtml.includes('Sign In to Access Ask Documents') && askHtml.includes('Upload PDF');
    const compareDoesNotBlockGuest = !compareHtml.includes('Sign In to Access Compare Documents');
    const verifyDoesNotBlockGuest = !verifyHtml.includes('Sign In to Access Verify Numbers');
    const testLabDoesNotBlockGuest = !testLabHtml.includes('Sign In to Access Test Laboratory');

    assert(
      hasSignInBtnMyDocs && hasPromptTextMyDocs && askDoesNotBlockGuest && compareDoesNotBlockGuest && verifyDoesNotBlockGuest && testLabDoesNotBlockGuest,
      'Test 2: Signed-out guest: My Documents prompts sign-in, while Ask Documents, Verify, Compare, and Test Lab are accessible',
      'Confirmed My Documents strictly enforces sign-in, while Ask Documents and other workspace features are open to guests.',
      `Unexpected guest blocking behavior: myDocs=${hasPromptTextMyDocs}, askBlocked=${askHtml.includes('Sign In to Access Ask Documents')}`
    );
  }

  // TEST CASE 3: Signed-in user: only their own Supabase documents appear
  {
    const html = renderToString(
      <MyDocumentsView
        documents={[userDoc]}
        currentUser={authenticatedUser}
        selectedDocId="doc-user-1"
        onSelectDocument={noop}
        onOpenViewer={noop}
        onNavigateToAsk={noop}
        onNavigateToVerify={noop}
        onDeleteDocument={noop}
        onRenameDocument={noop}
        onTriggerUpload={noop}
        onGoToAuth={noop}
      />
    );

    const hasUserDoc = html.includes('User Uploaded Policy');
    const hasNoSampleDocs =
      !html.includes('TamilNadu_CM_Health') &&
      !html.includes('UP_Krishi_Solar') &&
      !html.includes('Benchmark');
    const hasDocCount = html.includes('1 Document');

    if (!(hasUserDoc && hasNoSampleDocs && hasDocCount)) {
      console.log('Test 3 debug:');
      console.log('hasUserDoc:', hasUserDoc);
      console.log('hasNoSampleDocs:', hasNoSampleDocs);
      console.log('hasDocCount:', hasDocCount);
      console.log('Includes Benchmark:', html.includes('Benchmark'));
    }

    assert(
      hasUserDoc && hasNoSampleDocs && hasDocCount,
      'Test 3: Signed-in user: only their own Supabase documents appear',
      'User-owned document is correctly displayed with "1 Document" count, and sample documents are not present.',
      'User document view failed to isolate own document from sample documents.'
    );
  }

  // TEST CASE 4: Signed-in user: uploaded documents remain after refresh
  {
    // Check that App.tsx contains session recovery calling setCurrentPage('workspace')
    const fs = await import('fs');
    const appTsx = fs.readFileSync('src/App.tsx', 'utf-8');
    const workspaceTsx = fs.readFileSync('src/components/Workspace.tsx', 'utf-8');

    const appHasSessionRestore =
      appTsx.includes('supabase.auth.getSession()') &&
      appTsx.includes("setCurrentPage('workspace')");
    const appHasAuthStateChange = appTsx.includes('onAuthStateChange');
    const workspaceLoadsUserDocs =
      workspaceTsx.includes('fetchUserDocuments(currentUser.id)') &&
      !workspaceTsx.includes('SAMPLE_DOCUMENTS');

    assert(
      appHasSessionRestore && appHasAuthStateChange && workspaceLoadsUserDocs,
      'Test 4: Signed-in user: uploaded documents remain after refresh',
      'App.tsx properly recovers session and directs to workspace on refresh; Workspace.tsx re-fetches user documents from Supabase.',
      'Session restore or cloud document loading on refresh is not properly configured.'
    );
  }

  // TEST CASE 5: New signed-in user with no documents: show an empty state, not sample documents
  {
    const html = renderToString(
      <MyDocumentsView
        documents={[]}
        currentUser={authenticatedUser}
        selectedDocId=""
        onSelectDocument={noop}
        onOpenViewer={noop}
        onNavigateToAsk={noop}
        onNavigateToVerify={noop}
        onDeleteDocument={noop}
        onRenameDocument={noop}
        onTriggerUpload={noop}
        onGoToAuth={noop}
      />
    );

    const hasEmptyStateHeading = html.includes('No Documents in Your Library');
    const hasUploadFirstBtn = html.includes('Upload First Document');
    const hasZeroSampleDocs =
      !html.includes('TamilNadu_CM_Health') &&
      !html.includes('UP_Krishi_Solar') &&
      !html.includes('Benchmark');

    assert(
      hasEmptyStateHeading && hasUploadFirstBtn && hasZeroSampleDocs,
      'Test 5: New signed-in user with no documents: show an empty state, not sample documents',
      'Empty state is cleanly displayed for new users with an upload CTA, with zero fallback to sample documents.',
      'Sample documents or invalid state shown for new signed-in user.'
    );
  }

  console.log('\n--- All 5 Verification Tests Completed ---');
  const allPassed = results.every((r) => r.passed);
  console.log(`Summary: ${results.filter((r) => r.passed).length}/${results.length} tests passed.`);

  if (!allPassed) {
    process.exit(1);
  }
}

runTests().catch((err) => {
  console.error('Test execution failed:', err);
  process.exit(1);
});
