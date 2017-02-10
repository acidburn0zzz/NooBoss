var NooBoss={};

NooBoss.defaultValues=[
  ['userId',(Math.random().toString(36)+'00000000000000000').slice(2, 19)],
  ['joinCommunity',true],
  ['showAds',false],
  ['notifyStateChange',true],
  ['notifyInstallation',true],
  ['notifyRemoval',true],
  ['autoState',true],
  ['autoStateNotification',true],
  ['autoStateRules','[]'],
  ['sortOrder','nameState'],
  ['recoExtensions',true],
  ['defaultPage','manage'],
  ['notificationDuration_autoState',5],
  ['notificationDuration_stateChange',5],
  ['notificationDuration_installation',-1],
  ['notificationDuration_removal',-1]
];

NooBoss.resetSettings=function(){
  var temp;
  for(var i=1;i<NooBoss.defaultValues.length;i++){
    temp=NooBoss.defaultValues[i];
    set(temp[0],temp[1]);
  }
}

NooBoss.resetIndexedDB=function(){
  var req= window.indexedDB.deleteDatabase('NooBoss');
  req.onerror=function(e){
    console.log(e);
  }
  req.onsuccess=function(e){
    NooBoss.Management.init();
  }
}

NooBoss.initDefaultValues=function(){
  var temp;
  for(var i=0;i<NooBoss.defaultValues.length;i++){
    temp=NooBoss.defaultValues[i];
    setIfNull(temp[0],temp[1]);
  }
}

NooBoss.Util={};

NooBoss.Util.getIcon=function(appInfo,callback){
  var iconUrl=undefined;
  if(appInfo.icons){
    var maxSize=0;
    for(var j=0;j<appInfo.icons.length;j++){
      var iconInfo=appInfo.icons[j];
      if(iconInfo.size>maxSize){
        maxSize=iconInfo.size;
        iconUrl=iconInfo.url;
      }
    }
  }
  if(!iconUrl){
    var canvas=document.createElement("canvas");
    canvas.width=128;
    canvas.height=128;
    var ctx=canvas.getContext('2d');
    ctx.font="120px Arial";
    ctx.fillStyle="grey";
    ctx.fillRect(0,0,canvas.width,canvas.height);
    ctx.fillStyle="white";
    ctx.fillText(appInfo.name[0],22,110);
    var dataUrl=canvas.toDataURL();
    callback(dataUrl);
  }
  else{
    dataUrlFromUrl(iconUrl,callback);
  }
}


//Management
NooBoss.Management={};
NooBoss.Management.autoState={};
NooBoss.Management.autoState.enable=function(){
  NooBoss.Management.autoState.init();
  chrome.tabs.onCreated.addListener(function(tab){
    NooBoss.Management.autoState.newTab(tab);
  });
  chrome.tabs.onUpdated.addListener(function(tabId,info,tab){
    NooBoss.Management.autoState.updateTab(tabId,info,tab);
  });
  chrome.tabs.onRemoved.addListener(function(tabId){
    NooBoss.Management.autoState.removeTab(tabId);
  });
  chrome.tabs.onReplaced.addListener(function(addedTabId,removedTabId){
    chrome.tabs.get(addedTabId,function(tab){
      NooBoss.Management.autoState.newTab(tab);
    });
  });
}
NooBoss.Management.autoState.newTab=function(tab){
  NooBoss.Management.autoState.tabs[tab.id]=tab.url;
  NooBoss.Management.autoState.manage(tab.id);
}
NooBoss.Management.autoState.updateTab=function(tabId,changeInfo,tab){
  if(changeInfo.url){
    var oldUrl=(NooBoss.Management.autoState.tabs[tabId]||{}).url;
    if(oldUrl!=changeInfo.url){
      NooBoss.Management.autoState.tabs[tabId]=changeInfo.url;
      NooBoss.Management.autoState.manage(tabId);
    }
  }
}
NooBoss.Management.autoState.removeTab=function(tabId){
  NooBoss.Management.autoState.tabs[tabId]=null;
  NooBoss.Management.autoState.manage(tabId);
}
NooBoss.Management.autoState.disable=function(){
  chrome.tabs.onCreated.removeListener();
  chrome.tabs.onUpdated.removeListener();
  chrome.tabs.onRemoved.removeListener();
  chrome.tabs.onReplaced.removeListener();
}
NooBoss.Management.autoState.manage=function(tabId){
  var autoState=NooBoss.Management.autoState;
  var tabs=autoState.tabs;
  var nextPhases={};
  var enableOnlys={};
  var disableOnlys={};
  for(var i=0;i<autoState.rules.length;i++){
    var rule=autoState.rules[i];
    var appIds=rule.ids;
    var pattern=new RegExp(rule.match.url,'i');
    var tabIds=Object.keys(tabs);
    var matched=false;
    for(var j=0;j<tabIds.length;j++){
      var url=tabs[tabIds[j]];
      if(pattern.exec(url)){
        matched=true;
        break;
      }
    }
    switch(rule.action){
      case 'enableOnly':
        if(matched){
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: true,
              tabid: tabId,
              ruleId: i
            }
            enableOnlys[appIds[k]]=true;
          }
        }
        else{
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: enableOnlys[appIds[k]]||false,
              tabid: null,
              ruleId: i
            }
          }
        }
        break;
      case 'disableOnly':
        if(matched){
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: false,
              tabid: tabId,
              ruleId: i
            }
            disableOnlys[appIds[k]]=true;
          }
        }
        else{
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: (!disableOnlys[appIds[k]])&&true,
              tabid: null,
              ruleId: i
            }
          }
        }
        break;
      case 'enableWhen':
        if(matched){
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: true,
              tabid: tabId,
              ruleId: i
            }
          }
        }
        break;
      case 'disableWhen':
        if(matched){
          for(var k=0;k<appIds.length;k++){
            nextPhases[appIds[k]]={
              enabled: false,
              tabid: null,
              ruleId: i
            }
          }
        }
        break;
    }
  }
  var ids=Object.keys(nextPhases);
  for(var i=0;i<ids.length;i++){
    var id=ids[i];
    var phase=nextPhases[id];
    autoState.setAppState(id,phase.enabled,phase.tabId,phase.ruleId);
  }
}

NooBoss.Management.autoState.setAppState=function(id,enabled,tabId,ruleId){
  if(NooBoss.Management.apps[id]){
    var appInfo=NooBoss.Management.apps[id];
    if(appInfo&&appInfo.enabled!=enabled){
      appInfo.enabled=enabled;
      chrome.management.setEnabled(id, enabled,function(){
        var enabledStr='enabled';
        if(!enabled){
          enabledStr='disabled';
        }
        isOn('autoStateNotification',function(){
          chrome.notifications.create({
            type:'basic',
            iconUrl: '/images/icon_128.png',
            title: 'Auto state management',
            message: appInfo.name+' has been '+enabledStr+' because of rule #'+(ruleId+1),
            requireInteraction: true
          },function(notificationId){
            get('notificationDuration_autoState',function(time){
              if(time>0){
                setTimeout(function(){
                  chrome.notifications.clear(notificationId,function(){});
                },time*1000);
              }
            });
          });
        });
        get('userId',function(userId){
          newCommunityRecord(false,{userId:userId,category:'AutoState',event:enabledStr});
        });
        if(tabId){
          chrome.tabs.reload(tabId);
        }
      });
    }
  }
}

NooBoss.Management.autoState.init=function(){
  //{[id],condition,match}
  NooBoss.Management.autoState.rules=[];
  NooBoss.Management.autoState.tabs={};
  chrome.tabs.query({},function(tabList){
    for(var i=0;i<tabList.length;i++){
      var tabInfo=tabList[i];
      NooBoss.Management.autoState.tabs[tabInfo.id]=tabInfo.url;
    }
    NooBoss.Management.autoState.updateRules();
  });
}
NooBoss.Management.autoState.updateRules=function(){
  get('autoStateRules',function(data){
    if(data){
      NooBoss.Management.autoState.rules=JSON.parse(data);
      NooBoss.Management.autoState.manage();
    }
  });
}
NooBoss.Management.updateAppInfo=function(appInfo,extraInfo,callback){
  NooBoss.Util.getIcon(appInfo,function(dataUrl){
    appInfo.icon=dataUrl;
    getDB(appInfo.id,function(oldInfo){
      if(!oldInfo){
        oldInfo={};
        var time=new Date().getTime();
        oldInfo.installedDate=time;
        oldInfo.lastUpdateDate=time;
      }
      $.extend(oldInfo,appInfo,extraInfo);
      setDB(appInfo.id,oldInfo,callback);
    });
  });
}

NooBoss.Management.updateAppInfoById=function(id,updateInfo){
  getDB(id,function(oldInfo){
    if(oldInfo){
      $.extend(oldInfo,updateInfo);
      setDB(id,oldInfo);
    }
  });
}

NooBoss.Management.init=function(){
  chrome.management.getAll(function(appInfoList){
    var apps={};
    for(var i=0;i<appInfoList.length;i++){
      var appInfo=appInfoList[i];
      NooBoss.Management.updateAppInfo(appInfo);
      apps[appInfo.id]=appInfo;
    }
    NooBoss.Management.apps=apps;
  });
  isOn('autoState',
    NooBoss.Management.autoState.enable);
}

NooBoss.listeners={};
NooBoss.listeners.onEnabled=function(appInfoOld){
  var id=appInfoOld.id;
  if(!NooBoss.Management.apps[id]){
    console.log('a');
    setTimeout(NooBoss.listeners.onEnabled.bind(null,appInfoOld),900);
    return;
  }
  NooBoss.Management.apps[id].enabled=true;
  var recordEnable=function(times,appInfo){
    if(!appInfo){
      if(times<9){
        setTimeout(getDB.bind(null,id,recordEnable.bind(null,times+1)),1000);
      }
    }
    else{
      NooBoss.History.addRecord({event:'enabled', id:appInfo.id, icon: appInfo.icon, name:appInfo.name, version:appInfo.version});
    }
  }
  getDB(id,recordEnable.bind(null,1));
  isOn('notifyStateChange',function(){
    chrome.notifications.create({
      type:'basic',
      iconUrl: '/images/icon_128.png',
      title: 'Enabled: '+appInfoOld.name,
      message: appInfoOld.name+' is now enabled',
      requireInteraction: true
    },function(notificationId){
        get('notificationDuration_stateChange',function(time){
          if(time>0){
            setTimeout(function(){
              chrome.notifications.clear(notificationId,function(){});
            },time*1000);
          }
        });
      });
  });
}

//History
NooBoss.History={};
NooBoss.History.init=function(){
  getDB('history_records',function(recordList){
    NooBoss.History.recordList=recordList||[];
  });
}
NooBoss.History.addRecord=function(record){
  record.date=new Date().getTime();
  NooBoss.History.recordList.push(record);
  setDB('history_records',NooBoss.History.recordList);
}
NooBoss.History.listen=function(){
  chrome.management.onInstalled.addListener(function(appInfo){
    NooBoss.Management.apps[appInfo.id]={enabled:appInfo.enabled,name:appInfo.name};
    getDB(appInfo.id,function(appInfoRecord){
      if(!appInfoRecord){
        appInfoRecord={};
      }
      var time=new Date().getTime();
      var event='installed';
      var message=GL('ls_26');
      console.log(appInfoRecord);
      if((!appInfoRecord.lastUpdateDate)||(!appInfoRecord.uninstalledDate)||appInfoRecord.lastUpdateDate>appInfoRecord.uninstalledDate){
        if(appInfoRecord.version<appInfo.version){
          event='updated';
          message=GL('ls_27');
        }
      }
      NooBoss.Management.updateAppInfo(appInfo,{lastUpdateDate:time},function(data){
        getDB(appInfo.id,function(appInfo){
          NooBoss.History.addRecord({event:event, id:appInfo.id, icon: appInfo.icon, name:appInfo.name, version:appInfo.version});
          isOn('notifyInstallation',function(){
            chrome.notifications.create({
              type:'basic',
              iconUrl: '/images/icon_128.png',
              title: appInfo.name+' '+event,
              message: appInfo.name+' '+message,
              requireInteraction: true
            },function(notificationId){
              get('notificationDuration_installation',function(time){
                if(time>0){
                  setTimeout(function(){
                    chrome.notifications.clear(notificationId,function(){});
                  },time*1000);
                }
              });
            });
          });
        });
      });
    });
  });
  chrome.management.onUninstalled.addListener(function(id){
    NooBoss.Management.apps[id]=null;
    var recordUninstall=function(times,appInfo){
      if(!appInfo){
        if(times<9){
          setTimeout(getDB.bind(null,id,recordUninstall.bind(null,times+1)),1000);
        }
      }
      else{
        NooBoss.History.addRecord({event:'removed', id:appInfo.id, icon: appInfo.icon, name:appInfo.name, version:appInfo.version});
      }
    }
    getDB(id,recordUninstall.bind(null,1));
    NooBoss.Management.updateAppInfoById(id,{uninstalledDate:new Date().getTime()});
    isOn('notifyRemoval',function(){
      getDB(id,function(appInfo){
        chrome.notifications.create({
          type:'basic',
          iconUrl: '/images/icon_128.png',
          title: appInfo.name+' '+capFirst(GL('removed')),
          message: appInfo.name+' '+GL('ls_28'),
          requireInteraction: true
        },function(notificationId){
            get('notificationDuration_removal',function(time){
              if(time>0){
                setTimeout(function(){
                  chrome.notifications.clear(notificationId,function(){});
                },time*1000);
              }
            });
          });
      });
    });
  });
  chrome.management.onEnabled.addListener(NooBoss.listeners.onEnabled.bind(null));
  chrome.management.onDisabled.addListener(function(appInfoOld){
    var id=appInfoOld.id;
    NooBoss.Management.apps[id].enabled=false;
    var recordDisable=function(times,appInfo){
      if(!appInfo){
        if(times<9){
          setTimeout(getDB.bind(null,id,recordUninstall.bind(null,times+1)),1000);
        }
      }
      else{
        NooBoss.History.addRecord({event:'disabled', id:appInfo.id, icon: appInfo.icon, name:appInfo.name, version:appInfo.version});
      }
    }
    getDB(id,recordDisable.bind(null,1));
    isOn('notifyStateChange',function(){
      chrome.notifications.create({
        type:'basic',
        iconUrl: '/images/icon_128.png',
        title: 'Disabled: '+appInfoOld.name,
        message: appInfoOld.name+' is now disabled',
        requireInteraction: true
      },function(notificationId){
          get('notificationDuration_stateChange',function(time){
            if(time>0){
              setTimeout(function(){
                chrome.notifications.clear(notificationId,function(){});
              },time*1000);
            }
          });
        });
    });
  });
}


NooBoss.init=function(){
  NooBoss.initDefaultValues();
  NooBoss.History.init();
  NooBoss.History.listen();
  NooBoss.Management.init();
}

document.addEventListener('DOMContentLoaded', function(){
  NooBoss.init()
  chrome.runtime.onMessage.addListener(
    function(request, sender, sendResponse) {
      if('job' in request){
        if (request.job == 'reset'){
          NooBoss.resetSettings();
          NooBoss.resetIndexedDB();
        }
        else if(request.job =='autoState'){
          isOn('autoState',
            NooBoss.Management.autoState.enable,
            NooBoss.Management.autoState.disable
          );
        }
        else if(request.job == 'updateAutoStateRules'){
          NooBoss.Management.autoState.updateRules();
        }
      }
    });
});
