angular.module('TomCss')

.controller('ServerSideController', function ($scope, $timeout, $cookies, Socket) {
  var self   = this,
      dialog = document.getElementById('Dialogs'),
      tipsTimer;

  self.messages          = [];
  self.socketUsers       = [];
  self.profile           = {};
  self.sideTab           = 'users';
  self.userTab           = 'pending';
  self.configTab         = 'personal';
  self.unreads           = [];
  self.pendings          = [];
  self.missedCustomers   = [];
  self.missedMessages    = [];
  self.historyCustomers  = [];
  self.historyMessages   = [];
  self.isBlur            = false;
  self.isTargetOffline   = false;
  self.lastOfflineSocket = '';

  angular.element(window).on('blur', function () {
    self.isBlur = true;
  });

  angular.element(window).on('focus', function () {
    self.isBlur = false;
  });

  // Define Private Methods.
  function getUser (socket_id) {
    var result = [];
    for (var i = 0, l = self.socketUsers.length; i < l; i++) {
      if (self.socketUsers[i]._id === socket_id) {
        result.push(self.socketUsers[i]);
      }
    }
    if (result.length > 0) {
      return result.length === 1 ? result[0] : result;
    } else {
      return null;
    }
  }

  function removeMsgFrom (socket_id, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].from_socket === socket_id) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  }

  function removeMsgTo (socket_id, group) {
    for (var i = 0, l = group.length; i < l; i++) {
      if (group[i].to_socket === socket_id) {
        group.splice(i, 1);
        l--;
        i--;
      }
    }
  }

  function removeAllMsg (socket_id, group) {
    var group = group || self.messages;
    removeMsgFrom(socket_id, group);
    removeMsgTo(socket_id, group);
  }

  function DialogToBottom () {
    $timeout(function () {
      dialog.scrollTop = dialog.scrollHeight;
    }, 100);
  }

  function isQueryTimeValid (type) {
    self[type + 'UsersStartDayTimestamp'] = +Date.parse(self[type + 'UsersStartDay']);
    self[type + 'UsersEndDayTimestamp'] = +Date.parse(self[type + 'UsersEndDay']) + (24 * 3600 * 1000);
    return self[type + 'UsersEndDayTimestamp'] > self[type + 'UsersStartDayTimestamp'];
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

  // Define Public Methods.

  self.hasPendingUser = function () {
    for (var i = 0, l = self.socketUsers.length; i < l; i++) {
      if (self.socketUsers[i].target === '' && (self.socketUsers[i].role !== 'receptor' && self.socketUsers[i].role !== 'admin')) {
        return true;
      }
    }
    return false;
  };

  self.countPendings = function (socket_id) {
    var count = 0;
    for (var i = 0, l = self.pendings.length; i < l; i++) {
      if (self.pendings[i].from_socket === socket_id) {
        count++;
      }
    }
    return count;
  };

  self.countUnreads = function (socket_id) {
    var count = 0;
    for (var i = 0, l = self.unreads.length; i < l; i++) {
      if (self.unreads[i].from_socket === socket_id) {
        count++;
      }
    }
    return count;
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

  self.recept = function (socket_id) {
    Socket.emit('i will recept someone', socket_id);
    self.userTab = 'recepting';
    self.isSidebarLoading = true;
  };

  self.login = function () {
    if (self.username && self.password && !self.loginInProcess) {
      Socket.emit('login', {
        name: self.username,
        pass: self.password
      });
      self.password = '';
      self.loginInProcess = true;
    }
  };

  self.logout = function () {
    if (confirm('您确定要登出？')) {
      Socket.emit('logout', self.profile.name);
    }
  };

  self.createReceptor = function () {
    if (self.profile.role !== 'admin') {
      alert('您没有此权限');
      return;
    }
    if (tipsTimer) {
      $timeout.cancel(tipsTimer);
    }
    if (!$scope.createReceptorForm.$valid) {
      self.createReceptorTips = '请检查各个字段是否完整、正确';
    }else if (self.newReceptorPass !== self.newReceptorPassConfirm) {
      self.createReceptorTips = '您两次输入的密码不符';
    } else {
      Socket.emit('create receptor', {
        name: self.newReceptorName,
        pass: self.newReceptorPass
      });
      self.createReceptorTips = '正在创建接线员，请稍候';
    }
    tipsTimer = $timeout(function () {
      self.createReceptorTips = '';
    }, 3000);
  };

  self.removeReceptor = function (username) {
    if (username === self.profile.name) {
      alert('不能删除自己');
      return;
    } else if (self.profile.role !== 'admin') {
      alert('您没有权限进行此操作');
      return;
    }
    if (confirm('您确定要删除接线员 ' + username + ' ？')) {
      for (var i = 0, l = self.receptors.length; i < l; i++) {
        if (self.receptors[i].name === username) {
          self.receptors.splice(i, 1);
          break;
        }
      }
      Socket.emit('remove receptor', username);
    }
  };

  self.changePass = function () {
    if (tipsTimer) {
      $timeout.cancel(tipsTimer);
    }
    if (!$scope.changePassForm.$valid) {
      self.changePassTips = '请检查各个字段是否完整、正确';
    } else if (self.myPassNew !== self.myPassNewConfirm) {
      self.changePassTips = '您两次输入的密码不符';
    } else {
      Socket.emit('change password', {
        oldPass: self.myPassOld,
        newPass: self.myPassNew
      });
      self.changePassTips = '正在修改密码，请稍候';
    }
    tipsTimer = $timeout(function () {
      self.changePassTips = '';
    }, 3000);
  };

  // 历史消息与离线消息相关
  // 获取错过了的客户列表
  self.getMissedCustomers = function () {
    if(isQueryTimeValid('missed')) {
      Socket.emit('get missed customers', {
        start: self.missedUsersStartDayTimestamp,
        end: self.missedUsersEndDayTimestamp
      });
    } else {
      alert('请输入正确的日期');
    }
  };
  // 获取历史用户列表
  self.getHistoryCustomers = function () {
    if(isQueryTimeValid('history')) {
      Socket.emit('get history customers', {
        start: self.historyUsersStartDayTimestamp,
        end: self.historyUsersEndDayTimestamp
      });
    } else {
      alert('请输入正确的日期');
    }
  };

  // 根据用户名获取离线消息
  self.getMissedMessages = function (name) {
    Socket.emit('get missed messages of someone', name);
    self.currentMissedCustomer = name;
  };
  // 根据用户名获取历史消息
  self.getHistoryMessages = function (name) {
    Socket.emit('get history messages of someone', name);
    self.currentHistoryCustomer = name;
  };

  // 查看离线游客列表
  Socket.on('show missed customers', function (customers) {
    // do something with data
    self.missedCustomers = customers;
  });
  // 查看某个离线客户的消息
  Socket.on('show missed messages of someone', function (messages) {
    self.missedMessages = messages;
    DialogToBottom();
  });

  // 查看历史用户列表
  Socket.on('show history customers', function (customers) {
    // do something with data
    self.historyCustomers = customers;
  });
  // 查看某个历史客户的消息
  Socket.on('show history messages of someone', function (messages) {
    self.historyMessages = messages;
    DialogToBottom();
  });

  // Define socket events.
  Socket.on('connection success', function (user) {
    self.profile = user;
    self.socketUsers.push(user);
    if ($cookies.HQName && $cookies.HQKey && !self.isLoggedIn) {
      self.username = $cookies.HQName;
      self.password = $cookies.HQKey;
      self.login();
    }
  });

  Socket.on('reconnect', function () { location.reload(); });
  Socket.on('reconnect_failed', function () { location.reload(); });

  Socket.on('login success', function (data) {
    self.isLoggedIn     = true;
    self.loginInProcess = false;
    self.socketUsers    = data.socketUsers;
    self.profile        = getUser(data.self._id);
    self.receptors      = data.receptors;
    $cookies.HQKey      = data.HQKey;
    $cookies.HQName     = self.profile.name;
  });

  Socket.on('create receptor response', function (data) {
    if (tipsTimer) {
      $timeout.cancel(tipsTimer);
    }
    tipsTimer = $timeout(function () {
      self.createReceptorTips = '';
    }, 3000);
    if (!data.status) {
      self.createReceptorTips = '添加成功！';
      self.newReceptorName = '';
      self.newReceptorPass = '';
      self.newReceptorPassConfirm = '';
    } else {
      if (data.status.code === 11000) {
        self.createReceptorTips = '此用户已经存在';
      } else {
        self.createReceptorTips = '添加失败，请联系管理员';
      }
    }
  });

  Socket.on('update receptor list', function (data) {
    self.receptors = data;
  });

  Socket.on('change password response', function (data) {
    if (tipsTimer) {
      $timeout.cancel(tipsTimer);
    }
    $timeout(function () {
      self.changePassTips = '';
    }, 3000);
    if (data.err) {
      self.changePassTips = data.err;
    } else {
      if (data.modified > 0) {
        self.changePassTips = '成功修改密码！';
        self.myPassNew = '';
        self.myPassNewConfirm = '';
      } else {
        self.changePassTips = '原密码有误，请重新输入';
      }
      self.myPassOld = '';
    }
  });

  Socket.on('login fail', function () {
    if ($cookies.HQKey) {
      $cookies.HQKey = '';
      alert('您的Session已经过期，请重新登录');
    } else {
      alert('帐号或密码不正确！');
    }
    self.loginInProcess = false;
  });

  Socket.on('add user', function (user) {
    self.socketUsers.push(user);
  });

  Socket.on('add receptor', function (user) {
    var receptor = getUser(user._id);
    receptor.role = user.role;
    receptor.name = user.name;
  });

  Socket.on('someone is recepted', function (data) {
    if (data.receptor === self.profile._id) {
      self.profile.target = data.recepted;
      self.profile.targetName = getUser(data.recepted).name;
      self.displayReceptTips = true;
      self.isSidebarLoading = false;
    }
    getUser(data.recepted).target = data.receptor;
    removeAllMsg(data.recepted, self.unreads);
    removeAllMsg(data.recepted, self.pendings);
    self.isTargetOffline = false;
    DialogToBottom();
  });

  Socket.on('add message', function (msg) {
    self.messages.push(msg);
    var newMsg = self.messages[self.messages.length - 1];

    if (self.isBlur === true) {
      if (newMsg.to_socket === self.profile._id) {
        EasyNotify('来自 ' + newMsg.from_name + ' 的消息', newMsg.content, '', {
          sideTab: 'users',
          userTab: 'recepting',
          recept_socket: newMsg.from_socket
        });
      }

      if (newMsg.to_socket === '') {
        EasyNotify('来自 ' + newMsg.from_name + ' 的消息', newMsg.content, '', {
          sideTab: 'users',
          userTab: 'pending',
          recept_socket: newMsg.from_socket
        });
      }
    }

    if (newMsg.to_socket === '') {
      self.pendings.push(newMsg);
    } else if (newMsg.to_socket === self.profile._id && self.profile.target !== newMsg.from_socket) {
      self.unreads.push(newMsg);
    } else {
      DialogToBottom();
    }
  });

  Socket.on('add history messages', function (data) {
    data.messages.forEach(function (msg) {
      // 如果是发给客户的消息，那么这些消息的来源改成当前接线员的ID
      if (msg.to_socket === data.customer) {
        msg.from_socket = self.profile._id;
      }
      // 如果是客户发过来的消息，那么这些消息的目标应该为空（本地）
      if (msg.from_socket === data.customer) {
        msg.to_socket = '';
      }
      // 删除多余的信息（$$hashKey）
      msg = {
        from_socket: msg.from_socket,
        to_socket: msg.to_socket,
        from_name: msg.from_name,
        to_name: msg.to_name,
        content: msg.content,
        create_time: msg.create_time
      };
    });
    // 把消息放入messages和pendings
    Array.prototype.push.apply(self.messages, data.messages);
    Array.prototype.push.apply(self.pendings, data.messages);
  });

  Socket.on('customer disconnect', function (socket_id) {
    self.socketUsers.splice(self.socketUsers.indexOf(getUser(socket_id)), 1);
    if (self.lastOfflineSocket) {
      removeAllMsg(self.lastOfflineSocket);
      removeAllMsg(self.lastOfflineSocket, self.unreads);
    }
    self.lastOfflineSocket = socket_id;
    self.isTargetOffline  = self.profile.target === socket_id;
  });

  Socket.on('receptor disconnect', function (socket_id) {
    self.socketUsers.splice(self.socketUsers.indexOf(getUser(socket_id)), 1);
    self.socketUsers.forEach(function (item, index) {
      if (item.target === socket_id) {
        item.target = '';
      }
    });
    removeAllMsg(socket_id);
    removeAllMsg(socket_id, self.unreads);
  });

  Socket.on('logout success', function () {
    $cookies.HQKey  = '';
    $cookies.HQName = '';
    location.reload();
  });
});
