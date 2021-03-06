/* global Touches: true, Directions: true, Sons: true, SonsObjects: true, createjs */

// Collection pour communiquer les touches tapees
Touches = new Mongo.Collection('touches');

//Definition des directions: URL des pages 'vers'
//La c'est pour 4 joueurs, mais ca pourrait etre plus...
Directions = ['est', 'sud', 'ouest', 'nord'];
const directionAlpha = Math.PI * 2 / Directions.length;

//Definition des sons
//Peut etre augmentee, diminuee, changee...
Sons = [
  {
    fileName: 'ACM1_full',
    htmlText: '<b>C’est la vie qui resonne d’un mur a l’autre</b>',
    image: '/images/ACM1.jpg',
  },
  {
    fileName: 'ACM2_trou',
    htmlText: '<i>de caches pour ne pas dire de trous</i>',
    image: '/images/ACM2.jpg',
  },
  {
    fileName: 'ACM3_ciel',
    htmlText: '<span style="color: green;">Ciel Vert Safran</span>',
    image: '/images/ACM3.jpg',
  },
  {
    fileName: 'ACM4_suinte_x',
    htmlText: '<span style="color: blue;">Suinte etc...</span>',
    image: '/images/ACM4.jpg',
  },
  {
    fileName: 'ACM5_tatonne',
    htmlText: '<span style="color: yellow;">Ta tonne ! Gros fat</span>',
    image: '/images/ACM5.jpg',
  },
  {
    fileName: 'ACM6_hivers',
    htmlText: '<span style="color: purple;">hivers doux clame. Clame clam ? Blouboup</span>',
    image: '/images/ACM6.jpg',
  },
  {
    fileName: 'ACM7_passage',
    htmlText: '<span style="color: grey;">Moliere trebuche</span>',
    image: '/images/ACM7.jpg',
  },
  {
    fileName: 'ACM8_reperes',
    htmlText: '<span style="color: orange;">paires</span>',
    image: '/images/ACM8.jpg',
  },
  {
    fileName: 'ACM9_echappee',
    htmlText: '<span style="color: red;">Hey</span> chat prout',
    image: '/images/ACM9.jpg',
  },
];
const sonAlpha = Math.PI * 2 / Sons.length;
const sonExtension = 'm4a';

// Format necessite par la library Sound de createJS
// CF http://www.createjs.com/demos/soundjs/playonclick
// et https://github.com/CreateJS/SoundJS/blob/master/examples/02_PlayOnClick.html
SonsObjects = Sons.map((son, idx) => {
  return {
    fileName: son.fileName,
    src: `${son.fileName}.${sonExtension}`,
    id: idx,
  };
});

if (Meteor.isClient) {
  //Visualisation et ecoute
  Router.route('/', {
    onBeforeAction: function() {
      Router.go('coeur');
      this.next();
    },
  });
  Router.route('/coeur', {
    name: 'coeur',
    template: 'coeur',
  });

  //Controles
  Router.route('vers/:directionName', {
    name: 'vers',
    template: 'vers',
  });
}

//reset de la base de donnee
if (Meteor.isServer) {
  Meteor.startup(function() {
    Touches.remove({});

    //1 document par direction insere dans la base de donnees
    Directions.forEach((direction) => {
      Touches.insert({
        name: direction,
        currentTouch: null,
        touchOccurences: 0,
        isPlaying: false,
      });
    });
  });
}

// Logique des pages
//=========PAGE COEUR
if (Meteor.isClient) {
  //Donnee accessible au coeur
  Template.coeur.helpers({
    'directions': () => _.map(Directions, (dir, idx) => {
      return {name: dir, index: idx};
    }),
  });


  Template.coeur.rendered = function() {
    // On se positionne en cercle pour se la peter
    // http://stackoverflow.com/questions/8436187/circular-layout-of-html-elements
    const directionsElems = this.$('.direction-container');
    const x0 = window.innerWidth / 2;
    const y0 = window.innerHeight / 2;
    const xRadius = 0.75 * window.innerWidth / 2;
    const yRadius = 0.75 * window.innerHeight / 2;

    directionsElems.each(function(index, elem) {
      const x = x0 + xRadius * Math.cos(directionAlpha * index);
      const y = y0 + yRadius * Math.sin(directionAlpha * index);

      elem.style.left = `${x}px`;
      elem.style.top = `${y}px`;
    });

    // On Load les sons avec createJS
    // https://github.com/CreateJS/SoundJS/blob/master/examples/02_PlayOnClick.html
    const soundLoaded = function(event) {
      console.log('sound loaded', event.id);
    };

    const init = function() {
      if (!createjs.Sound.initializeDefaultPlugins()) {
        alert('error init createjs');
        return;
      }

      const assetsPath = '/';
      // createjs.Sound.alternateExtensions = ['mp3']; // add other extensions to try loading if the src file extension is not supported
      createjs.Sound.addEventListener('fileload', createjs.proxy(soundLoaded, this)); // add an event listener for when load is completed
      createjs.Sound.registerSounds(SonsObjects, assetsPath);
    };

    init();
  };

  Template.direction.created = function() {
    //counter of different sound touches
    this.touchOccurences = null;

    //Sound player state
    this.preload = null;
    this.soundInstance = null;

    //not used ?
    this.stopAll = () => {
      if (this.preload !== null) {
        this.preload.close();
      }
      createjs.Sound.stop();
    };
    this.playSound = (target) => {
      //We do not allow several sounds by
      const soundPlaying = !(this.soundInstance === null
        || this.soundInstance.playState === createjs.Sound.PLAY_FINISHED
        || this.soundInstance.playState === createjs.Sound.PLAY_FAILED);
      if (soundPlaying) {
        this.soundInstance.stop();
      }

      //Playing with the pan and volume
      const soundOptions = {
        // east right, west left
        pan: 0.0001 - Math.cos(directionAlpha * this.data.index),
        // south loudest, north lowest
        volume: 0.6 + 0.4 * Math.sin(directionAlpha * this.data.index),
      };

      //Play the sound: play (src, interrupt, delay, offset, loop, volume, pan)
      this.soundInstance = createjs.Sound.play(target.id, soundOptions);
      if (this.soundInstance === null ||
        this.soundInstance.playState === createjs.Sound.PLAY_FAILED) {
        return;
      }

      //saying the touch of the direction is playing
      const touchId = Touches.findOne({
        name: Template.currentData().name,
      })._id;
      Touches.update({_id: touchId}, {
        $set: {touchPlaying: true},
      });

      this.soundInstance.addEventListener('complete', (instance) => {
        //reporting back that the play is over
        const touchId = Touches.findOne({
          name: this.data.name,
        })._id;
        Touches.update({_id: touchId}, {
          $set: {touchPlaying: false},
        });
        console.log('finished playing');
      });
    };
  };

  //donnees et events des directions
  Template.direction.events({
    'click .direction-name': function(event, template) {
      Router.go('vers', {directionName: this.name});
    },
  });

  Template.direction.helpers({
    'touchOccurences': function() {
      const temp = Template.instance();
      if (temp.touchOccurences === null) temp.touchOccurences = 0;

      const currentTouch = Touches.findOne({name: this.name}, {fields: {
        touchOccurences: 1,
        currentTouch: 1,
      }});

      let touchOccurences = currentTouch.touchOccurences;

      //PLAY SOUND
      //Si l'occurence a bien change au reloading du helper
      //et pas a une autre reactivite
      //Du coup on joue le son qui correspond a la touche jouee
      if (touchOccurences !== temp.touchOccurences) {
        const soundToPlayForThisTouch = _.find(SonsObjects,
          (obj) => obj.fileName === currentTouch.currentTouch);
        temp.playSound(soundToPlayForThisTouch);
        temp.touchOccurences = touchOccurences;
      }
      return touchOccurences;
    },
    'sonCourant': function() {
      const sonCourant = Touches.findOne({name: this.name})
        .currentTouch;
      return sonCourant;
    },
    'sonHtmlText': function() {
      const sonCourant = Touches.findOne({name: this.name})
        .currentTouch;
      const son = _.find(Sons,
        (obj) => obj.fileName === sonCourant);
      return son ? son.htmlText : '';
    },
    'sonImage': function() {
      const sonCourant = Touches.findOne({name: this.name})
        .currentTouch;
      const son = _.find(Sons,
        (obj) => obj.fileName === sonCourant);
      return son ? son.image : '';
    },
  });
}

//=========PAGES VERS
if (Meteor.isClient) {
  //Send the touch event to coeur
  const updateTouch = (directionName, fileName) => {
    const touchId = Touches.findOne({name: directionName})._id;
    Touches.update({_id: touchId}, {
      $inc: {touchOccurences: 1},
      $set: {currentTouch: fileName},
    });
  };

  Template.vers.created = function() {
    //extracting the direction name from the route url
    this.directionName = Router.current().params.directionName;
  };

  Template.vers.helpers({
    'sons': () => Sons,
    'directionName': () => Template.instance().directionName,
    'sonImage': function() {
      const sonCourant = Touches.findOne({
        name: Template.instance().directionName})
        .currentTouch;
      const son = _.find(Sons,
        (obj) => obj.fileName === sonCourant);
      return son ? son.image : '';
    },
  });


  Template.vers.rendered = function() {
    // On se positionne toujours en cercle pour se la peter
    const directionsElems = this.$('.son-container');
    const x0 = window.innerWidth / 2;
    const y0 = window.innerHeight / 2;
    const xRadius = 0.75 * window.innerWidth / 2;
    const yRadius = 0.75 * window.innerHeight / 2;

    directionsElems.each(function(index, elem) {
      const x = x0 + xRadius * Math.cos(sonAlpha * index);
      const y = y0 + yRadius * Math.sin(sonAlpha * index);
      elem.style.left = `${x}px`;
      elem.style.top = `${y}px`;
    });

    // Yes, you can play with a,b,c,d,e... depending of the number of sounds !
    $(window).on('keydown', (e) => {
      const aKeyCode = 65;
      const keyPressedCode = e.which;
      // b=66, c =67...
      if (aKeyCode < keyPressedCode
        && keyPressedCode < aKeyCode + Sons.length - 1) {
        const sonIndex = keyPressedCode - aKeyCode;
        updateTouch(this.directionName, Sons[sonIndex].fileName);
        e.preventDefault();
      }
    });
  };

  //donnees et events des directions
  Template.sonTemplate.events({
    'click .son-name': function(event, template) {
      updateTouch(this.directionName, this.son.fileName);
    },
  });

  Template.sonTemplate.helpers({
    'isPlaying': function() {
      const touch = Touches.findOne({name: this.directionName});
      return touch.currentTouch === this.son.fileName
        && touch.touchPlaying;
    },
  });
}
