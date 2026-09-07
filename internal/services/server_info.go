package services

import "sync"

var serverInfo = struct { sync.RWMutex; Host string; Port string; LANURL string }{}

func SetServerInfo(host, port, lanURL string) { serverInfo.Lock(); defer serverInfo.Unlock(); serverInfo.Host,serverInfo.Port,serverInfo.LANURL=host,port,lanURL }
func ServerInfo() (string,string,string) { serverInfo.RLock(); defer serverInfo.RUnlock(); return serverInfo.Host,serverInfo.Port,serverInfo.LANURL }
