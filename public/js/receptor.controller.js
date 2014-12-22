angular.module('TomCss')

.controller('ServerSideController', function ($scope, $timeout, $cookies, Socket) {
  var self   = this,
      dialog = document.getElementById('Dialogs');

  self.displayMsgs       = [];
  self.users             = [];
  self.operators         = [];
  self.profile           = {};
  self.sideTab           = 'users';
  self.userTab           = 'pending';
  self.configTab         = 'personal';
  self.unreads           = [];
  self.pendings          = [];
  self.isBlur            = false;
  self.isLoading         = false;
  self.isLoggedIn        = false;

  angular.element(window).on('blur', function () {
    self.isBlur = true;
  });

  angular.element(window).on('focus', function () {
    self.isBlur = false;
  });

  // Define Private Methods.
  function DialogToBottom () {
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  }

  function onNotificationClick (param) {
    window.focus();
    var user = getUser(param.recept_socket);
    if (user && (!user.target || user.target === self.profile._id)) {
      self.recept(param.recept_socket);
      self.sideTab = param.sideTab;
      self.userTab = param.userTab;
    }
  }

  function EasyNotify(title, content, iconUrl, param) {
    var Notification = window.Notification || navigator.webkitNotifications,
        content = content || '',
        iconUrl = iconUrl || '//' + location.host + '/favicon.ico',
        param   = param || {};

    if (!Notification) {
      window.Notification = function () {};
    }

    else if (Notification.permission === 'granted') {
      var notification = new Notification(title, {icon: iconUrl, body: content});
      notification.onclick = function () {
        onNotificationClick(param);
      };
    }

    else if (Notification.permission !== 'denied') {
      Notification.requestPermission(function (permission) {
        if (permission === 'granted') {
          var notification = new Notification(title, {icon: iconUrl, body: content});
          notification.onclick = function () {
            onNotificationClick(param);
          };
        }
      });
    }
  }

  self.login = function () {
    if (self.username) {
      if (self.password) {
        Socket.emit('operator login', {
          name: self.username,
          pass: self.password
        });
      } else {
        Socket.emit('operator login', {
          name : self.username,
          token: self.token
        });
      }
      self.password = '';
      self.isLoading = true;
    }
  };

  self.logout = function () {
    if (confirm('您确定要登出？')) {
      Socket.emit('operator logout');
    }
  };

  self.submitText = function () {
    if (self.currentText && (self.userTab === 'pending' || self.userTab === 'recepting') && self.profile.target !== '' && getUser(self.profile.target) !== null) {
      Socket.emit('web message', self.currentText);
      self.currentText = '';
      self.displayReceptTips = false;
    }
  };

  self.submitIfEnter = function (e) {
    var e = e || window.event;
    if (e.keyCode === 13) {
      self.submitText();
    }
  };

  self.recept = function (uid) {
    Socket.emit('recept user', uid);
    self.isLoading = true;
  };

  // auto login
  if ($cookies.hq_username && $cookies.hq_token && !self.isLoggedIn) {
    self.username = $cookies.hq_username;
    self.token    = $cookies.hq_token;
    self.login();
  }

  // Define socket events.
  // connections
  Socket.on('connection success', function (user) {
    self.profile = user;
  });

  Socket.on('reconnect', function () { location.reload(); });
  Socket.on('reconnect_failed', function () { location.reload(); });

  // 成功登陆
  Socket.on('login success', function (data) {
    self.isLoading       = false;
    self.isLoggedIn      = true;
    self.profile         = data;
    $cookies.hq_id       = data._id || '';
    $cookies.hq_token    = data.token;
    $cookies.hq_username = data.username;
    $cookies.hq_nickname = data.nickname || data.username;
    Socket.emit('get unread users');
  });

  // 登录失败
  Socket.on('login fail', function () {
    if ($cookies.hq_token) {
      $cookies.hq_token = '';
      alert('您的Session已经过期，请重新登录');
    } else {
      alert('帐号或密码不正确！');
    }
    self.isLoading = false;
  });

  // 成功获取用户列表
  Socket.on('get unread users success', function (data) {
    self.pendings = self.pendings.concat(data);
  });

  // 成功接待用户
  Socket.on('recept user success', function (data) {
    self.profile.target = data;
    console.log(self);
  });

  // 成功获取历史消息
  Socket.on('read history messages success', function (data) {
    self.displayMsgs = data;
    self.isLoading = false;
  });

  Socket.on('logout success', function () {
    $cookies.hq_token = null;
    location.reload();
  });
});
