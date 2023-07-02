/*
 * Copyright 2022 ICON Foundation
 *
 * Licensed under the Apache License, Version 2.0 (the "License");
 * you may not use this file except in compliance with the License.
 * You may obtain a copy of the License at
 *
 *     http://www.apache.org/licenses/LICENSE-2.0
 *
 * Unless required by applicable law or agreed to in writing, software
 * distributed under the License is distributed on an "AS IS" BASIS,
 * WITHOUT WARRANTIES OR CONDITIONS OF ANY KIND, either express or implied.
 * See the License for the specific language governing permissions and
 * limitations under the License.
 */

package app;

//import foundation.icon.btp.xcall.CallServiceReceiver;
import foundation.icon.score.client.ScoreClient;
import score.Address;
import score.Context;
import score.DictDB;
import score.UserRevertedException;
import score.VarDB;
import score.annotation.EventLog;
import score.annotation.External;
import score.annotation.Optional;
import score.annotation.Payable;
import scorex.util.HashMap;

import java.math.BigInteger;
import java.util.Map;

@ScoreClient
//public class CrossChainVoting implements CallServiceReceiver {
public class CrossChainVoting {
    //    private final XCallProxy xCall;
//    private final String callSvcBtpAddr;
    private final VarDB<BigInteger> countOfYes = Context.newVarDB("yes", BigInteger.class);
    private final VarDB<BigInteger> countOfNo = Context.newVarDB("no", BigInteger.class);
    private final VarDB<String> destinationBtpAddress = Context.newVarDB("btpAddress", String.class);
    private final VarDB<Address> xcallContractAddress = Context.newVarDB("xcall", Address.class);

    public CrossChainVoting(Address _sourceXCallContract, String _destinationBtpAddress) {
//        this.xCall = new XCallProxy(_callService);
//        this.callSvcBtpAddr = xCall.getBtpAddress();
        this.destinationBtpAddress.set(_destinationBtpAddress);
        this.xcallContractAddress.set(_sourceXCallContract);
        this.countOfNo.set(BigInteger.ZERO);
        this.countOfYes.set(BigInteger.ZERO);
    }

    private BigInteger _sendCallMessage(byte[] _data, @Optional byte[] _rollback) {
        Address xcallSourceAddress = this.xcallContractAddress.get();
        String _to = this.destinationBtpAddress.get();
        return Context.call(BigInteger.class, xcallSourceAddress, "sendCallMessage", _to, _data, _rollback);
    }

    @Payable
    @External
    public void voteYes() {
        // Increase local count of Yes votes
        BigInteger sum = this.countOfYes.get().add(BigInteger.ONE);
        this.countOfYes.set(sum);

        // make call to xcall
        byte[] _rollback = null;
        String payload = "voteYes";
        byte[] bytePayload = payload.getBytes();

        BigInteger id = _sendCallMessage(bytePayload, _rollback);
        Context.println("sendCallMessage Response:" + id);
    }

    @Payable
    @External
    public void voteNo() {
        // Increase local count of No votes
        BigInteger sum = this.countOfNo.get().add(BigInteger.ONE);
        this.countOfNo.set(sum);

        // make call to xcall
        byte[] _rollback = null;
        String payload = "voteNo";
        byte[] bytePayload = payload.getBytes();

        BigInteger id = _sendCallMessage(bytePayload, _rollback);
        Context.println("sendCallMessage Response:" + id);
    }

    @External(readonly = true)
    public Map<String, BigInteger> getVotes() {
        Map<String, BigInteger> votesMap = new HashMap<>();
        votesMap.put("yes", this.countOfYes.get());
        votesMap.put("no", this.countOfNo.get());
        return votesMap;
    }

    @External(readonly = true)
    public String getDestinationBtpAddress() {
        return this.destinationBtpAddress.get();
    }

    @External(readonly = true)
    public Address getXCallContractAddress() {
        return this.xcallContractAddress.get();
    }
//    private void onlyCallService() {
//        Context.require(Context.getCaller().equals(xCall.address()), "onlyCallService");
//    }
//
//    private BigInteger getNextId() {
//        BigInteger _id = this.id.getOrDefault(BigInteger.ZERO);
//        _id = _id.add(BigInteger.ONE);
//        this.id.set(_id);
//        return _id;
//    }
//
//    @Payable
//    @External
//    public void sendMessage(String _to, byte[] _data, @Optional byte[] _rollback) {
//        if (_rollback != null) {
//            // The code below is not actually necessary because the _rollback data is stored on the xCall side,
//            // but in this example, it is needed for testing to compare the _rollback data later.
//            var id = getNextId();
//            Context.println("DAppProxy: store rollback data with id=" + id);
//            RollbackData rbData = new RollbackData(id, _rollback);
//            var ssn = _sendCallMessage(Context.getValue(), _to, _data, rbData.toBytes());
//            rbData.setSvcSn(ssn);
//            rollbacks.set(id, rbData);
//        } else {
//            // This is for one-way message
//            _sendCallMessage(Context.getValue(), _to, _data, null);
//        }
//    }
//
//    private BigInteger _sendCallMessage(BigInteger value, String to, byte[] data, byte[] rollback) {
//        try {
//            return xCall.sendCallMessage(value, to, data, rollback);
//        } catch (UserRevertedException e) {
//            // propagate the error code to the caller
//            Context.revert(e.getCode(), "UserReverted");
//            return BigInteger.ZERO; // call flow does not reach here, but make compiler happy
//        }
//    }
//
//    @Override
    @External
    public void handleCallMessage(String _from, byte[] _data) {
//        onlyCallService();
//        Context.println("handleCallMessage: from=" + _from);
//        if (callSvcBtpAddr.equals(_from)) {
//            // handle rollback data here
//            // In this example, just compare it with the stored one.
//            RollbackData received = RollbackData.fromBytes(_data);
//            var id = received.getId();
//            RollbackData stored = rollbacks.get(id);
//            Context.require(stored != null, "invalid received id");
//            Context.require(received.equals(stored), "rollbackData mismatch");
//            rollbacks.set(id, null); // cleanup
//            RollbackDataReceived(_from, stored.getSvcSn(), received.getRollback());
//        } else {
//            // normal message delivery
//            String msgData = new String(_data);
//            Context.println("handleCallMessage: msgData=" + msgData);
//            if ("revertMessage".equals(msgData)) {
//                Context.revert("revertFromDApp");
//            }
//            MessageReceived(_from, _data);
//        }
    }
//
//    @EventLog
//    public void MessageReceived(String _from, byte[] _data) {}
//
//    @EventLog
//    public void RollbackDataReceived(String _from, BigInteger _ssn, byte[] _rollback) {}
}
