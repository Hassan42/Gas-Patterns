// SPDX-License-Identifier: MIT
pragma solidity ^0.8.0;

contract PartialRecoveryExec {
    enum State {
        Closed,
        Open,
        Completed
    }

    mapping(string => State) public state;

    uint receiveFunctionCount = 5;

    mapping(string => address) public contracts;

    mapping(address => string) public addressToRole;

    mapping(string => string[]) public activitytoRole;

    struct Item {
        uint256 id;
        uint256 quantity;
    }

    struct Order {
        Item[] items;
        bool domestic;
        bool clearance;
        string deliveryAddress;
        address customer;
    }

    mapping(uint256 => Order) public orders;
    uint256 public nextOrderId;

    mapping(uint256 => uint256) public stock;
    mapping(uint256 => uint256) public prices;

    // mapping(address => uint256) public depositedGas;
    // mapping(address => uint256) public gasUsedByUser;
    // address[] public gasUsers;
    // mapping(address => bool) public isGasUser;
    // uint256 public gasPriceInWei;

    modifier isAccessible(string memory _activity) {
        require(state[_activity] == State.Open, "Activity is not open");

        //** Disabling authentication for the sake of the example */
        // string memory userRole = addressToRole[msg.sender];
        // bool hasRequiredRole = false;

        // // If no roles are defined for the activity, grant access
        // if (activitytoRole[_activity].length == 0) {
        //     hasRequiredRole = true;
        // } else {
        //     // Iterate through the array of roles for the activity
        //     for (uint256 i = 0; i < activitytoRole[_activity].length; i++) {
        //         if (
        //             bytes(activitytoRole[_activity][i]).length == 0 ||
        //             compareStrings(userRole, activitytoRole[_activity][i])
        //         ) {
        //             hasRequiredRole = true;
        //             break;
        //         }
        //     }
        // }

        // require(hasRequiredRole, "Caller does not have the required role");
        //** Disabling authentication for the sake of the example */
        _;
    }

    event Event_15b3i41(uint256 orderId, uint256[] unavailableItemIds);

    // event Event_0hk6axb(uint256 orderid);

    event Event_0hk6axy(uint256 orderid);

    event RefundEvent(string user, uint256 amountRefunded); // Refund Event

    constructor() {
        // state["Activity_0fun8ap"] = State.Open;
        state["Activity_0niv12y"] = State.Open;
        state["Activity_1vaacll"] = State.Closed;
        state["Activity_0k0x70l"] = State.Closed;
        state["Activity_1hhx3o3"] = State.Closed;

        // activitytoRole["Activity_0fun8ap"] = ["Retailer"];
        activitytoRole["Activity_0niv12y"] = ["Customer"];
        activitytoRole["Activity_1vaacll"] = ["Customer"];
        activitytoRole["Activity_0k0x70l"] = ["Customs"];
        activitytoRole["Activity_1hhx3o3"] = ["Logistics"];
        // activitytoRole["Activity_0nflsru"] = ["Retailer"];
    }

    function setContracts(address[] memory addresses) public {}

    //Unavailable Items
    function emit_Event_15b3i41(
        uint256 orderId,
        uint256[] memory unavailableItemIds
    ) public {
        emit Event_15b3i41(orderId, unavailableItemIds);
    }

    //Order Delivered
    // function emit_Event_0hk6axb(uint256 orderid) public {
    //     emit Event_0hk6axb(orderid);
    // }

    //Custom Clearance
    function emit_Event_0hk6axy(uint256 orderid) public {
        emit Event_0hk6axy(orderid);
    }

    function setResources(
        string[] memory _roles,
        address[] memory _addresses
    ) public {
        require(
            _roles.length == _addresses.length,
            "Roles and addresses arrays must be of the same length"
        );

        for (uint i = 0; i < _addresses.length; i++) {
            addressToRole[_addresses[i]] = _roles[i];
        }
    }

    function setResource(string memory _role, address _address) public {
        addressToRole[_address] = _role;
    }

    function setState(string memory _activity, uint8 _state) public {
        require(_state <= 3, "Not Valid State");
        state[_activity] = State(_state);
    }

    function setStock(uint256 itemId, uint256 quantity) public {
        stock[itemId] = quantity;
    }

    function setPrice(uint256 itemId, uint256 priceInWei) public {
        prices[itemId] = priceInWei;
    }

    function getState(string memory _activity) public view returns (State) {
        return state[_activity];
    }

    function getOrderItems(
        uint256 orderId
    ) external view returns (Item[] memory) {
        return orders[orderId].items;
    }

    //To be replaced with ENUM
    function compareStrings(
        string memory a,
        string memory b
    ) internal pure returns (bool) {
        return keccak256(abi.encodePacked(a)) == keccak256(abi.encodePacked(b));
    }

    //Fund Gas Fees
    // function Activity_0fun8ap()
    //     public
    //     payable
    //     isAccessible("Activity_0fun8ap")
    // {
    //     depositedGas[msg.sender] += msg.value;
    //     gasPriceInWei = tx.gasprice;

    //     if (!isGasUser[msg.sender]) {
    //         gasUsers.push(msg.sender);
    //         isGasUser[msg.sender] = true;
    //     }

    //     state["Activity_0niv12y"] = State.Open;
    //     state["Activity_0fun8ap"] = State.Completed;
    // }

    //Order Details
    function Activity_0niv12y(
        uint256[] memory itemIds,
        uint256[] memory quantities,
        bool domestic,
        string memory deliveryAddress
    ) public payable isAccessible("Activity_0niv12y") {
        // uint256 startGas = gasleft();
        uint256 total = compute_total(itemIds, quantities);
        // uint256 branch = checkXOR_Gateway_06a3ggk(total);
        // if ((branch & (1 << 1)) != 0) {
            uint256 orderId = Activity_11y12ie(domestic, deliveryAddress);
            bool isAvailable = Activity_1ojqh22(orderId, itemIds, quantities);

            uint256 branch = checkXOR_Gateway_1vn0uda(isAvailable);
            if ((branch & (1 << 0)) != 0) {
                state["Activity_1vaacll"] = State.Open;
            } else if ((branch & (1 << 1)) != 0) {
                Activity_13zf3km(total);
                uint256 branch = checkXOR_Gateway_1p6hag5(
                    orders[orderId].domestic
                );
                if ((branch & (1 << 0)) != 0) {
                    state["Activity_0k0x70l"] = State.Open;
                } else if ((branch & (1 << 1)) != 0) {
                    state["Activity_1hhx3o3"] = State.Open;
                }
            }
        // }
        //  else if ((branch & (1 << 0)) != 0) {
        //     //Out of balance
        //     revert("End Event reached: Event_0blgw7w, undefined");
        // }

        // if (!isGasUser[msg.sender]) {
        //     gasUsers.push(msg.sender);
        //     isGasUser[msg.sender] = true;
        // }
        state["Activity_0niv12y"] = State.Completed;
        // gasUsedByUser[msg.sender] += (startGas - gasleft()) + 21000 ;
    }

    //Create Order
    function Activity_11y12ie(
        bool domestic,
        string memory deliveryAddress
    ) public payable returns (uint256) {
        require(uint256(state["Activity_0niv12y"]) == uint256(State.Open));

        uint256 orderId = nextOrderId++;
        Order storage newOrder = orders[orderId];
        newOrder.domestic = domestic;
        newOrder.clearance = false;
        newOrder.deliveryAddress = deliveryAddress;
        newOrder.customer = msg.sender;

        return orderId;
    }

    //Add items
    function Activity_1ojqh22(
        uint256 orderId,
        uint256[] memory itemIds,
        uint256[] memory quantities
    ) public payable returns (bool) {
        require(
            uint256(state["Activity_0niv12y"]) == uint256(State.Open) ||
                uint256(state["Activity_1vaacll"]) == uint256(State.Open)
        );
        uint256[] memory unavailableItemIds = new uint256[](itemIds.length);
        uint256 count = 0;

        for (uint256 i = 0; i < itemIds.length; i++) {
            uint256 itemId = itemIds[i];
            uint256 requested = quantities[i];
            uint256 available = stock[itemId];

            if (available >= requested) {
                stock[itemId] -= requested;
                orders[orderId].items.push(
                    Item({id: itemId, quantity: requested})
                );
            } else {
                unavailableItemIds[count++] = itemId;
            }
        }

        if (count > 0) {
            uint256[] memory trimmed = new uint256[](count);
            for (uint256 j = 0; j < count; j++) {
                trimmed[j] = unavailableItemIds[j];
            }
            emit_Event_15b3i41(orderId, trimmed);
            return true;
        }
        return false;
    }

    //Modify Items
    function Activity_1vaacll(
        uint256 orderId,
        uint256[] memory itemIds,
        uint256[] memory quantities
    ) public payable isAccessible("Activity_1vaacll") {
        // uint256 startGas = gasleft();
        // uint256 branch = checkXOR_Gateway_06a3ggk(total);
        // if ((branch & (1 << 0)) != 0) {
            //Unsufficient ETH
            // revert("End Event reached: Event_0blgw7w, undefined");
        // } else if ((branch & (1 << 1)) != 0) {
            bool isAvailable = Activity_1ojqh22(orderId, itemIds, quantities);
            uint256 branch = checkXOR_Gateway_1vn0uda(isAvailable);
            if ((branch & (1 << 0)) != 0) {
                state["Activity_1vaacll"] = State.Open;
            } else if ((branch & (1 << 1)) != 0) {
                uint256 total = compute_total(itemIds, quantities);
                Activity_13zf3km(total);
                uint256 branch = checkXOR_Gateway_1p6hag5(
                    orders[orderId].domestic
                );
                if ((branch & (1 << 0)) != 0) {
                    state["Activity_0k0x70l"] = State.Open;
                } else if ((branch & (1 << 1)) != 0) {
                    state["Activity_1hhx3o3"] = State.Open;
                }
            }
        // }

        // if (!isGasUser[msg.sender]) {
        //     gasUsers.push(msg.sender);
        //     isGasUser[msg.sender] = true;
        // }
        // gasUsedByUser[msg.sender] += (startGas - gasleft()) + 21000 ;
    }

    //Make payments
    function Activity_13zf3km(uint256 total) public payable {
        require(
            uint256(state["Activity_0niv12y"]) == uint256(State.Open) ||
                uint256(state["Activity_1vaacll"]) == uint256(State.Open)
        );

        address payable burnAddress = payable(
            0x000000000000000000000000000000000000dEaD
        );

        // Send the ETH to the burn address
        (bool sent, ) = burnAddress.call{value: total}("");
        require(sent, "Failed to send Ether");
    }

    //Customs Clearance
    function Activity_0k0x70l(
        uint256 orderId
    ) public payable isAccessible("Activity_0k0x70l") {
        // Activity_1gto5jv(orderId);
        emit_Event_0hk6axy(orderId);
        state["Activity_1hhx3o3"] = State.Open;

        state["Activity_0k0x70l"] = State.Completed;
    }

    //Update Order status
    function Activity_1gto5jv(uint256 orderId) public payable {
        require(uint256(state["Activity_0k0x70l"]) == uint256(State.Open));
        orders[orderId].clearance = true;
    }

    //Order Delivered
    function Activity_1hhx3o3(
        uint256 orderId
    ) public payable isAccessible("Activity_1hhx3o3") {
        Activity_1gto5jr(orderId);
        state["Activity_1hhx3o3"] = State.Completed;
    }

    function Activity_1gto5jr(uint256 orderId) public payable {
        require(uint256(state["Activity_1hhx3o3"]) == uint256(State.Open));
        orders[orderId].clearance = true;
    }

    //Release Escrow
    // function Activity_0nflsru()
    //     public
    //     payable
    //     isAccessible("Activity_0nflsru")
    // {
    //     Activity_0g1cqca();

    //     state["Activity_0nflsru"] = State.Completed;
    // }

    // //Refund Gas
    // function Activity_0g1cqca() public payable {
    //     require(state["Activity_0nflsru"] == State.Open, "Activity not open");

    //     uint256 totalDeposited = 0;
    //     uint256 totalGasUsed = 0;
    //     // Sum up deposited funds and gas usage over all gasUsers
    //     for (uint256 i = 0; i < gasUsers.length; i++) {
    //         address user = gasUsers[i];
    //         totalDeposited += depositedGas[user];
    //         totalGasUsed += gasUsedByUser[user];
    //     }

    //     // Calculate total gas cost (in wei) using stored gasPriceInWei
    //     uint256 totalGasCost = totalGasUsed * gasPriceInWei;

    //     if (totalDeposited >= totalGasCost) {
    //         // Sufficient funds scenario

    //         // 1. Refund spenders fully (those who spent gas)
    //         for (uint256 i = 0; i < gasUsers.length; i++) {
    //             address user = gasUsers[i];
    //             if (gasUsedByUser[user] > 0) {
    //                 uint256 refundAmount = gasUsedByUser[user] * gasPriceInWei;
    //                 if (refundAmount > 0) {
    //                     payable(user).transfer(refundAmount);
    //                     emit RefundEvent(addressToRole[user], refundAmount); // Emit refund event
    //                 }
    //             }
    //         }
    //         // 2. Calculate surplus and refund funders proportionally
    //         uint256 surplus = totalDeposited - totalGasCost;
    //         for (uint256 i = 0; i < gasUsers.length; i++) {
    //             address user = gasUsers[i];
    //             if (depositedGas[user] > 0) {
    //                 // this user is a funder
    //                 uint256 refundShare = (surplus * depositedGas[user]) /
    //                     totalDeposited;
    //                 if (refundShare > 0) {
    //                     payable(user).transfer(refundShare);
    //                     emit RefundEvent(addressToRole[user], refundShare); // Emit refund event
    //                 }
    //             }
    //         }
    //     } else {
    //         // Insufficient funds scenario: distribute the entire deposit proportionally to spenders
    //         // (Only users who have consumed gas get a share)
    //         for (uint256 i = 0; i < gasUsers.length; i++) {
    //             address user = gasUsers[i];
    //             if (gasUsedByUser[user] > 0) {
    //                 uint256 proportionalRefund = (gasUsedByUser[user] *
    //                     gasPriceInWei *
    //                     totalDeposited) / totalGasCost;
    //                 if (proportionalRefund > 0) {
    //                     payable(user).transfer(proportionalRefund);
    //                     emit RefundEvent(addressToRole[user], proportionalRefund); // Emit refund event
    //                 }
    //             }
    //         }
    //     }

    //     // Clear the tracking for next use
    //     for (uint256 i = 0; i < gasUsers.length; i++) {
    //         address user = gasUsers[i];
    //         depositedGas[user] = 0;
    //         gasUsedByUser[user] = 0;
    //         isGasUser[user] = false;
    //     }
    //     delete gasUsers;
    // }



    function compute_total(
        uint256[] memory itemIds,
        uint256[] memory quantities
    ) internal view returns (uint256) {
        uint256 total = 0;
        for (uint256 i = 0; i < itemIds.length; i++) {
            total += prices[itemIds[i]] * quantities[i];
        }

        return total;
    }

    //ETH check
    // function checkXOR_Gateway_06a3ggk(
    //     uint256 total
    // ) public payable returns (uint256) {
    //     require(
    //         uint256(state["Activity_0niv12y"]) == uint256(State.Open) ||
    //             uint256(state["Activity_1vaacll"]) == uint256(State.Open)
    //     );

    //     if (msg.value < total) {
    //         return (1 << 0); // Branch 0
    //     } else if (msg.value >= total) {
    //         return (1 << 1); // Branch 1
    //     }
    // }

    //Item Unavailable
    function checkXOR_Gateway_1vn0uda(
        bool isAvailable
    ) public view returns (uint256) {
        require(
            uint256(state["Activity_0niv12y"]) == uint256(State.Open) ||
                uint256(state["Activity_1vaacll"]) == uint256(State.Open)
        );

        if (isAvailable) {
            return (1 << 0); // Branch 0
        } else {
            return (1 << 1); // Branch 1
        }
    }

    //Cross-border
    function checkXOR_Gateway_1p6hag5(
        bool domestic
    ) public view returns (uint256) {
        require(
            uint256(state["Activity_0niv12y"]) == uint256(State.Open) ||
                uint256(state["Activity_1vaacll"]) == uint256(State.Open)
        );

        if (!domestic) {
            return (1 << 0); // Branch 0
        } else {
            return (1 << 1); // Branch 1
        }
    }
}
