<script>
  import { pageState, selectedImage, jumpCard } from '../stores/pageState';
  import {
    gazerReady,
    gazerInitVideoDone,
    calibrationPct,
    calibrationCutoff,
    stateIndex,
    loadingInd,
    sessionID,
    gazerInitDone,
    testMode,
    sessionName,
    gazeReactions,
    gazerRecordingArt,
  } from '../stores/gazerState';
  import { slide, fade } from 'svelte/transition';
  import Overview from '../components/RecordOverview.svelte';
  import CalibrateVid from '../components/RecordCalibrateVid.svelte';
  import CalibrateExercise from '../components/RecordCalibrateExercise.svelte';
  import CalibrateInstructions from '../components/RecordCalibrateInstructions.svelte';
  import CalibrateResults from '../components/RecordCalibrateResults.svelte';
  import CalibrateView from '../components/RecordView.svelte';
  import Log from '../components/RecordLog.svelte';
  import { onMount } from 'svelte';
  //to write to db
  import {
    gazerInitialize,
    gazerMoveVideo,
    gazerInitVideo,
    gazerRestartCalibration,
  } from '../utils/gazerUtils.js';
  import { hideGazerForLater } from '../utils/gazerUtils';

  import { dbGet, dbWrite } from '../utils/firebaseUtils.js';
  import { time_ranges_to_array } from 'svelte/internal';
  import * as localforage from 'localforage';

  let disableBack = false,
    disableNext = false,
    hideNext = false;
  let calibrated = false;

  let sectionsNotCalibrated = [
    {
      sectionName: 'overview',
      sectionLabel: 'Overview',
      videoShown: false,
      btnLabel: 'Start!',
      disableBack: true,
      showLoader: true,
      btnBackLabel: 'Back to Overview',
      disableNext: true,
    },
    {
      sectionName: 'calibrate-vid',
      sectionLabel: 'Calibration - Align Face',
      videoShown: true,
      videoPos: 'middle',
      disableBack: false,
      disableNext: false,
      btnBackLabel: 'Back to Overview',
      btnLabel: 'Got It - Face is Aligned',
      showLoader: true,
    },
    {
      sectionName: 'calibrate-instructions',
      sectionLabel: 'Calibration - Instructions',
      videoShown: true,
      videoPos: 'top',
      btnBackLabel: 'Back to Video Alignment',
      btnLabel: 'Got It - Proceed',
    },
    {
      sectionName: 'calibrate-exercise',
      sectionLabel: 'Calibration - Exercise',
      videoShown: true,
      videoPos: 'top',
      disableNext: true,
      btnBackLabel: 'Restart Eye Calibration',
      btnLabel: 'Proceed to View Art',
      gazerRecording: true,
    },
    {
      sectionName: 'view',
      sectionLabel: 'View',
      videoShown: false,
      btnLabel: 'Proceed',
      disableNext: false,
      btnBackLabel: 'Back to Calibration',
      showLoader: true,
    },
    {
      sectionName: 'log',
      sectionLabel: 'Add Reaction',
      videoShown: false,
      btnLabel: 'Submit Reactions and View Gaze',
      disableBack: true,
      hideNext: false,
      btnBackLabel: 'Back to Results',
    },
  ];
  //change from index
  let sectionsCalibrated = [
    {
      sectionLabel: 'Calibration - Align Face',
      sectionName: 'calibrate-vid',
      videoShown: true,
      videoPos: 'middle',
      disableBack: true,
      disableNext: false,
      btnBackLabel: 'Back to Overview',
      btnLabel: 'Got It - Face is Aligned',
      showLoader: true,
    },
    sectionsNotCalibrated[4],
    sectionsNotCalibrated[5],
  ];
  let sections = sectionsNotCalibrated;

  async function checkExistingCalibration() {
    let gazerData = await localforage.getItem('webgazerGlobalData');
    let calPct = await localforage.getItem('calibrationPct');
    calibrationPct.set(calPct);
    if (gazerData) {
      if (gazerData.length > 20 && calPct > $calibrationCutoff) {
        sections = sectionsCalibrated;
        calibrated = true;
      } else {
        sections = sectionsNotCalibrated;
      }
    }

    //should store the date of calibration. if more than a day then it don't count sry bb
  }
  function recalibrate() {
    calibrated = false;
    sections = sectionsNotCalibrated;
    calibrationPct.set(null);
    webgazer.clearData();
  }
  checkExistingCalibration(); //this should happen and return before anything else loads

  onMount(() => {
    stateIndex.set(0);
    //set unique ID for session
    if (!$sessionID) {
      sessionID.set(new Date().getTime());
    }
    if (!$gazerInitDone) {
      gazerInitialize();
    }
    document.querySelector('body').className = 'gaze';
  });

  //WRITE DATA TO DB - REACTIONS AND SESSION
  async function submitSession() {
    if ($testMode == 0) {
      await dbWrite(
        'works/' + $selectedImage.key + '/sessionData/' + $sessionID + '/name',
        $sessionName
      );
      console.log('session written to db');
      await dbWrite('reactions/' + $sessionID, $gazeReactions);
      console.log('reaction written to db');
    }

    //switch pages only after video container is moved to body
    let observer = new MutationObserver((mutationRecords) => {
      if (mutationRecords[0].removedNodes.length > 0) {
        jumpCard.set($selectedImage.key);
        pageState.set('gallery');
      }
    });
    // observe everything except attributes
    observer.observe(document.querySelector('.container-body'), {
      childList: true, // observe direct children
      subtree: false, // lower descendants too
      characterDataOldValue: true, // pass old data to callback
    });

    hideGazerForLater();
    $gazeReactions = [];
  }

  //move video, disable next and prev buttons on subpage change
  let gazeActive, gazeRecording, currSection;
  $: {
    $gazerInitVideoDone;
    if (currSection.videoShown == true && $gazerInitVideoDone == true) {
      webgazer.showVideo(true);
      gazerMoveVideo(currSection.videoPos);
    } else {
      webgazer.showVideo(false);
    }
  }

  $: {
    currSection = sections[$stateIndex];
    currSection.disableBack ? (disableBack = true) : (disableBack = false);
    currSection.disableNext ? (disableNext = true) : (disableNext = false);
    currSection.hideNext ? (hideNext = true) : (hideNext = false);
  }

  //reactively update loading indicator for sections
  $: {
    $gazerInitVideoDone, $gazerInitDone;
    sectionsNotCalibrated[0].loadingVar = $gazerInitDone;
    sectionsNotCalibrated[1].loadingVar = $gazerInitVideoDone;
    sectionsCalibrated[0].loadingVar = $gazerInitVideoDone;
    if (currSection) {
      if (currSection.showLoader == true && !currSection.loadingVar) {
        loadingInd.set(true);
      } else {
        loadingInd.set(false);
      }
    }
  }

  $: {
    //needs to change on state index change
    if ($calibrationPct > $calibrationCutoff) {
      disableNext = false;
    }
  }
</script>

<section class="experiment-container">
  <div class="container-header">
    <div class="current-selection">
      {currSection.sectionLabel}
    </div>
    <div class="nav-ind">
      {#each sections as section}
        <div class="nav-dot" class:active={sections[$stateIndex] === section} />
      {/each}
    </div>
  </div>
  <div class="container-body">
    {#if sections[$stateIndex].sectionName == 'overview'}
      <div>
        <Overview bind:currSection />
      </div>
    {:else if sections[$stateIndex].sectionName == 'calibrate-vid'}
      <CalibrateVid {calibrated} />
    {:else if sections[$stateIndex].sectionName == 'calibrate-instructions'}
      <CalibrateInstructions />
    {:else if sections[$stateIndex].sectionName == 'calibrate-exercise'}
      <CalibrateExercise />
    {:else if sections[$stateIndex].sectionName == 'view'}
      <CalibrateView />
    {:else if sections[$stateIndex].sectionName == 'log'}
      <Log />
    {/if}
  </div>
  <div class="container-footer">
    {#if calibrated && $stateIndex !== sections.length - 1}
      <div
        class="btn clickable btn-light re-cal clickable"
        class:disabled={calibrated == false}
        on:click={recalibrate}
      >
        Re-Calibrate
      </div>
    {:else}
      <div
        class="btn-prev btn disabled btn-light"
        class:accent={$calibrationPct &&
          $calibrationPct < 70 &&
          $testMode !== 1}
        class:disabled={disableBack == true}
        on:click={() => {
          if (sections[$stateIndex].sectionName == 'calibrate-exercise') {
            gazerRestartCalibration();
          }
          $stateIndex--;
        }}
      >
        {sections[$stateIndex].btnBackLabel}
      </div>
    {/if}

    {#if !hideNext}
      <div
        on:click={() => {
          if ($stateIndex < sections.length - 2) {
            $stateIndex++;
          } else {
            submitSession();
          }
        }}
        class="btn-next btn accent clickable"
        class:disabled={$loadingInd || disableNext}
        class:glow={$loadingInd}
      >
        {#if $loadingInd}
          Loading...
        {:else}
          {sections[$stateIndex].btnLabel}
        {/if}
      </div>
    {/if}
  </div>
</section>

<style>
  :global(.container-footer .btn) {
    font-size: 16px;
    padding: 11px 40px;
    border-radius: 7px;
  }
  header {
    justify-content: space-between;
  }
  h3 {
    text-decoration: none;
  }
  .current-selection {
    font-size: 16px;
    font-weight: 500;
    color: var(--color-accent);
  }
  .experiment-container {
    background: var(--bg-contrast);
    width: 100%;
    margin-top: 50px;
    height: auto;
    border-radius: 5px;
    overflow: hidden;
    border: 1px solid rgba(0, 0, 0, 0.1);
  }
  .container-header,
  .container-footer,
  .container-body {
    padding: 0 30px;
  }
  .container-body {
    height: calc(100vh - 2 * var(--header-ht-gazer) - 75px);
    padding: 0 30px;
    font-size: 16px;
    position: relative;
    font-weight: 400;
  }
  .container-header,
  .container-footer {
    width: 100%;
    height: var(--header-ht-gazer);
    /* background: var(--bg-contrast-darker); */
  }
  .container-header {
    border-bottom: 1px solid rgba(0, 0, 0, 0.08);
    font-weight: 500;
  }
  .container-footer {
    box-shadow: var(--box-shadow-light-inverse);
  }

  .nav-ind {
    display: flex;
  }
  .container-header,
  .container-footer {
    display: flex;
    justify-content: space-between;
    align-items: center;
  }
  .selection-holder {
    background: var(--bg-contrast);
    padding: 5px 10px;
    margin-left: 10px;
    display: inline-flex;
  }
  #vid-holder {
    position: relative;
  }
  .nav-dot {
    width: 15px;
    height: 15px;
    border-radius: 100%;
    background: #dbd7d7;
    margin-right: 8px;
    transition: all 0.3s ease-in-out;
  }
  .nav-dot.active {
    background: var(--color-accent);
  }

  .btn-next.glow {
    animation: glowing 5000ms infinite;
    pointer-events: none;
  }
  .btn.disabled {
    opacity: 0;
    pointer-events: none;
  }

  .btn-next.disabled {
    opacity: 0.2;
    pointer-events: none;
    display: block;
  }

  @keyframes glowing {
    0% {
      background-color: var(--color-accent);
      opacity: 0.5;
    }
    50% {
      background-color: var(--bg-contrast-dark);
      opacity: 0.5;
    }
    100% {
      background-color: var(--color-accent);
      opacity: 0.5;
    }
  }
</style>
